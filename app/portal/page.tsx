import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import Button from "@/components/Button";
import { ensureProfile } from "@/lib/profile";
import { getUpcomingCachedEvent, syncUpcomingEvents, syncUserAttendance } from "@/lib/luma-sync";
import { recentAttendedEvents, syncEventGuests } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/login");

  const profile = await ensureProfile(session.user.id, session.user);

  try {
    await syncUpcomingEvents();
    // First visit: pull past Luma registrations so demo history isn't empty.
    const link = await prisma.lumaLink.findUnique({ where: { userId: session.user.id } });
    if (!link?.lastSyncedAt) await syncUserAttendance(session.user.id);
  } catch {
    // non-fatal on home
  }

  const [demos, attendances, upcoming] = await Promise.all([
    prisma.demoHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.attendance.findMany({
      where: { userId: session.user.id },
      include: { event: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    getUpcomingCachedEvent(),
  ]);
  if (upcoming) {
    try {
      await syncEventGuests(upcoming.lumaEventId);
    } catch {
      // non-fatal
    }
  }
  const recent = await recentAttendedEvents(session.user.id, 10);
  const toMark = recent.find((r) => r.live && r.checkedIn) ?? recent.find((r) => r.metCount === 0) ?? null;

  return (
    <div className="max-w-2xl space-y-12">
      <section className="space-y-3">
        <Eyebrow className="font-ui text-blueberry">Membership</Eyebrow>
        <h1 className="font-heading text-3xl lowercase leading-tight text-ink md:text-4xl">
          hey {profile.displayName?.split(" ")[0]?.toLowerCase() || "there"}
        </h1>
        <p className="max-w-md font-body text-base text-ink/75">
          Edit your profile, RSVP for this week, or find a ride across campus.
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Button href="/portal/rsvp" variant="dark" size="md">
          {upcoming ? "RSVP this week" : "RSVP"}
        </Button>
        <Button href="/portal/carpool" variant="primary" size="md">
          Carpool
        </Button>
        <Button href="/portal/profile" variant="outline" size="md">
          Edit profile
        </Button>
      </section>

      {toMark ? (
        <section className="space-y-3 rounded-[24px] bg-lime p-6">
          <Eyebrow className="font-ui text-ink/70">{toMark.live ? "You're checked in" : "Since Sunday"}</Eyebrow>
          <h2 className="font-heading text-2xl lowercase leading-tight text-ink md:text-3xl">{toMark.live ? "who are you meeting?" : "who did you meet?"}</h2>
          <p className="max-w-md font-body text-base text-ink/80">
            {toMark.live
              ? `Tap people as you talk to them at ${toMark.title}, and jot a line about what it was about while it's fresh.`
              : `Thirty seconds: tap the people you talked to at ${toMark.title}. It builds your met-graph, and it's how we'll know who to introduce you to.`}
          </p>
          <Button href={`/portal/met?event=${encodeURIComponent(toMark.lumaEventId)}`} variant="dark" size="md">
            {toMark.live ? "Open the room" : "Mark who you met"}
          </Button>
        </section>
      ) : null}

      {upcoming && (
        <section className="space-y-2 border-t border-dashed border-ink/15 pt-8">
          <Eyebrow className="font-ui text-blueberry">Upcoming</Eyebrow>
          <h2 className="font-heading text-2xl lowercase text-ink">
            {upcoming.title}
          </h2>
          <p className="font-body text-sm text-ink/55">
            {upcoming.startAt.toLocaleString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {upcoming.address ? ` · ${upcoming.address}` : ""}
          </p>
        </section>
      )}

      <section className="space-y-4 border-t border-dashed border-ink/15 pt-8">
        <div className="flex items-baseline justify-between">
          <Eyebrow className="font-ui text-blueberry">Recent demos</Eyebrow>
          <Link
            href="/portal/profile"
            className="font-ui text-[11px] uppercase text-ink/55 hover:text-ink"
          >
            Manage
          </Link>
        </div>
        {demos.length === 0 ? (
          <p className="font-body text-sm text-ink/55">
            Nothing yet — add what you&apos;ve been working on in your profile.
          </p>
        ) : (
          <ul className="space-y-3">
            {demos.map((demo) => (
              <li key={demo.id} className="font-body text-base text-ink/85">
                <span className="text-ink">{demo.title}</span>
                {demo.notes && (
                  <span className="mt-0.5 block text-sm text-ink/55">{demo.notes}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 border-t border-dashed border-ink/15 pt-8">
        <Eyebrow className="font-ui text-blueberry">Past attendance</Eyebrow>
        {attendances.length === 0 ? (
          <p className="font-body text-sm text-ink/55">
            No synced Sundays yet. RSVP once and they&apos;ll show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {attendances.map((a) => (
              <li
                key={a.id}
                className="flex items-baseline justify-between gap-4 font-body text-sm"
              >
                <span className="text-ink/85">{a.event.title}</span>
                <span className="shrink-0 font-ui text-[10px] uppercase text-ink/55">
                  {a.event.status !== "active" ? "cancelled" : a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
