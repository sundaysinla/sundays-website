import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import Button from "@/components/Button";
import { ensureProfile } from "@/lib/profile";
import { getUpcomingCachedEvent, syncUpcomingEvents, syncUserAttendance } from "@/lib/luma-sync";

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

  return (
    <div className="max-w-2xl space-y-12">
      <section className="space-y-3">
        <Eyebrow>Membership</Eyebrow>
        <h1 className="font-['Office-Times-Sharp-Regular'] text-3xl lowercase leading-tight text-[#010101] md:text-4xl">
          hey {profile.displayName?.split(" ")[0]?.toLowerCase() || "there"}
        </h1>
        <p className="max-w-md font-['Office-Times-Round'] text-base text-[#3A372F]">
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

      {upcoming && (
        <section className="space-y-2 border-t border-dashed border-[#C0B9A5]/50 pt-8">
          <Eyebrow>Upcoming</Eyebrow>
          <h2 className="font-['Office-Times-Sharp-Regular'] text-xl lowercase text-[#010101]">
            {upcoming.title}
          </h2>
          <p className="font-['Office-Times-Round'] text-sm text-[#8a8478]">
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

      <section className="space-y-4 border-t border-dashed border-[#C0B9A5]/50 pt-8">
        <div className="flex items-baseline justify-between">
          <Eyebrow>Recent demos</Eyebrow>
          <Link
            href="/portal/profile"
            className="font-['Monument-Grotesk'] text-[11px] uppercase text-[#C0B9A5] hover:text-[#8a8478]"
          >
            Manage
          </Link>
        </div>
        {demos.length === 0 ? (
          <p className="font-['Office-Times-Round'] text-sm text-[#8a8478]">
            Nothing yet — add what you&apos;ve been working on in your profile.
          </p>
        ) : (
          <ul className="space-y-3">
            {demos.map((demo) => (
              <li key={demo.id} className="font-['Office-Times-Round'] text-base text-[#2A2A24]">
                <span className="text-[#010101]">{demo.title}</span>
                {demo.notes && (
                  <span className="mt-0.5 block text-sm text-[#8a8478]">{demo.notes}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 border-t border-dashed border-[#C0B9A5]/50 pt-8">
        <Eyebrow>Past attendance</Eyebrow>
        {attendances.length === 0 ? (
          <p className="font-['Office-Times-Round'] text-sm text-[#8a8478]">
            No synced Sundays yet. RSVP once and they&apos;ll show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {attendances.map((a) => (
              <li
                key={a.id}
                className="flex items-baseline justify-between gap-4 font-['Office-Times-Round'] text-sm"
              >
                <span className="text-[#2A2A24]">{a.event.title}</span>
                <span className="shrink-0 font-['Monument-Grotesk'] text-[10px] uppercase text-[#C0B9A5]">
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
