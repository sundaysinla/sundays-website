import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  meta?: Prisma.InputJsonValue;
  emailSubject?: string;
}) {
  const profile = await prisma.profile.findUnique({
    where: { userId: params.userId },
  });

  let emailSent = false;
  const email = profile?.contactEmail;
  const canEmail =
    !!email &&
    !email.endsWith("@sundays.invalid") &&
    !!params.emailSubject;
  if (canEmail) {
    try {
      const base = process.env.AUTH_URL || "http://localhost:4000";
      await sendEmail({
        to: email,
        subject: params.emailSubject!,
        html: `
          <p>${params.body}</p>
          ${params.href ? `<p><a href="${base}${params.href}">Open carpool</a></p>` : ""}
        `,
      });
      emailSent = true;
    } catch (e) {
      console.warn("[notifications] email failed", e);
    }
  }

  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      href: params.href,
      meta: params.meta,
      emailSent,
    },
  });
}
