/**
 * Group chat per car. Anyone in the car (driver or a seated rider) can post
 * once they've been placed; hosts can post from the board. New messages fan
 * out as a text (if there's a phone) or an email, throttled to one notice per
 * person per 30 minutes so a busy thread doesn't spam.
 */

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { createNotification } from "@/lib/notifications";
import { firstName, offerName, offerPhone } from "@/lib/carpool/service";

export type MessageView = {
  id: string;
  body: string;
  createdAt: string;
  authorOfferId: string | null;
  authorFirstName: string;
  /** Full name, only when the viewer is allowed to see it. */
  authorName: string | null;
  isHost: boolean;
};

const NOTICE_GAP_MS = 30 * 60 * 1000;
const MAX_BODY = 600;

export async function listCarMessages(carId: string, opts: { revealNames: boolean; limit?: number }): Promise<MessageView[]> {
  const rows = await prisma.carMessage.findMany({
    where: { carId },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 100,
  });
  return rows.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    authorOfferId: m.authorOfferId,
    authorFirstName: m.authorOfferId ? firstName(m.authorName) : m.authorName,
    authorName: opts.revealNames || !m.authorOfferId ? m.authorName : null,
    isHost: !m.authorOfferId,
  }));
}

/** Is this offer the driver or a seated rider of the car? */
export async function offerIsInCar(offerId: string, carId: string) {
  const car = await prisma.car.findUnique({
    where: { id: carId },
    select: { driverOfferId: true, stops: { select: { riderOfferId: true } } },
  });
  if (!car) return false;
  return car.driverOfferId === offerId || car.stops.some((s) => s.riderOfferId === offerId);
}

export async function postCarMessage(params: {
  carId: string;
  body: string;
  author: { offerId: string } | { hostName: string };
}) {
  const body = params.body.trim();
  if (!body) throw new Error("Write something first");
  if (body.length > MAX_BODY) throw new Error(`Keep it under ${MAX_BODY} characters`);

  const car = await prisma.car.findUnique({
    where: { id: params.carId },
    include: {
      event: true,
      driverOffer: { include: { user: { include: { profile: true } } } },
      stops: { include: { riderOffer: { include: { user: { include: { profile: true } } } } } },
    },
  });
  if (!car) throw new Error("That car no longer exists");

  const members = [car.driverOffer, ...car.stops.map((s) => s.riderOffer)];
  const author = params.author;
  let authorName: string;
  let authorOfferId: string | null = null;
  if ("offerId" in author) {
    const me = members.find((m) => m.id === author.offerId);
    if (!me) throw new Error("You're not in this car");
    authorName = offerName(me);
    authorOfferId = me.id;
  } else {
    authorName = author.hostName.trim() || "Host";
  }

  const message = await prisma.carMessage.create({
    data: { carId: car.id, authorOfferId, authorName, body },
  });

  // Fan out, throttled per recipient.
  const label = authorOfferId ? firstName(authorName) : `${authorName} (host)`;
  const now = Date.now();
  for (const m of members) {
    if (m.id === authorOfferId) continue;
    const last = m.lastMessageNoticeAt?.getTime() ?? 0;
    if (now - last < NOTICE_GAP_MS) continue;
    await prisma.carpoolOffer.update({ where: { id: m.id }, data: { lastMessageNoticeAt: new Date(now) } });

    const phone = offerPhone(m);
    const excerpt = body.length > 160 ? `${body.slice(0, 157)}…` : body;
    const base = process.env.AUTH_URL || "http://localhost:4000";
    try {
      if (phone) {
        await sendSms(phone, `Sundays carpool · ${label}: ${excerpt}${m.userId ? ` — reply at ${base}/portal/carpool` : ""}`);
      } else if (m.userId) {
        await createNotification({
          userId: m.userId,
          type: "carpool_message",
          title: `${label} posted in your car`,
          body: excerpt,
          href: "/portal/carpool",
          emailSubject: `Sundays carpool — ${label}: ${excerpt.slice(0, 60)}`,
        });
        continue; // createNotification already recorded it
      } else if (m.guestEmail) {
        await sendEmail({
          to: m.guestEmail,
          subject: `Sundays carpool — ${label}: ${excerpt.slice(0, 60)}`,
          html: `<p><strong>${label}</strong> wrote in your Sunday car:</p><p>${excerpt}</p>`,
        });
      }
      if (m.userId) {
        await prisma.notification.create({
          data: { userId: m.userId, type: "carpool_message", title: `${label} posted in your car`, body: excerpt, href: "/portal/carpool", emailSent: false },
        });
      }
    } catch (e) {
      console.warn("[messages] notify failed", e);
    }
  }

  return message;
}
