import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureProfile } from "@/lib/profile";
import Eyebrow from "@/components/Eyebrow";
import Button from "@/components/Button";
import ProfileForms from "@/components/portal/ProfileForms";
import MetGraph from "@/components/portal/MetGraph";
import Link from "next/link";
import { loadMetGraph, recentAttendedEvents } from "@/lib/attendance";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/login");

  const profile = await ensureProfile(session.user.id, session.user);
  const graph = await loadMetGraph(session.user.id);
  const recentSunday = (await recentAttendedEvents(session.user.id, 10))[0] ?? null;
  const metPeople = graph.nodes.filter((n) => !n.me).sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
  const [demos, lumaLink, user] = await Promise.all([
    prisma.demoHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lumaLink.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { image: true } }),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3">
        <Eyebrow className="font-ui text-blueberry">Profile</Eyebrow>
        <h1 className="font-heading text-3xl lowercase text-ink md:text-4xl">
          your details
        </h1>
        <p className="max-w-md font-body text-base text-ink/75">
          Portfolio, contact email, and the projects you&apos;ve demoed at Sundays.
        </p>
      </section>

      <section className="space-y-4 border-t border-dashed border-ink/15 pt-8">
        <div className="flex items-baseline justify-between">
          <Eyebrow className="font-ui text-blueberry">People you&apos;ve met</Eyebrow>
          <Link href="/portal/met" className="font-ui text-[11px] uppercase text-ink/55 hover:text-ink">
            Mark more
          </Link>
        </div>
        {recentSunday ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button href={`/portal/met?event=${encodeURIComponent(recentSunday.lumaEventId)}`} variant="dark" size="md">
              {recentSunday.live ? "Who are you meeting right now?" : `Who did you meet at ${recentSunday.title}?`}
            </Button>
          </div>
        ) : null}
        {metPeople.length === 0 ? (
          <p className="font-body text-sm text-ink/55">
            Nobody yet. {recentSunday ? "Tap the people you talk to and they'll show up here as a graph." : "After a Sunday, tap the people you talked to and they'll show up here as a graph."}
          </p>
        ) : (
          <>
            <MetGraph nodes={graph.nodes} edges={graph.edges} />
            <ul className="divide-y divide-dashed divide-ink/12 border-t border-ink/15">
              {metPeople.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-body text-base text-ink">{p.name}</p>
                    {p.note ? <p className="font-body text-sm text-ink/60">{p.note}</p> : null}
                  </div>
                  <span className="shrink-0 font-ui text-[10px] uppercase tracking-wide text-ink/55">
                    {p.times} {p.times === 1 ? "Sunday" : "Sundays"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <ProfileForms
        profile={{
          displayName: profile.displayName,
          bio: profile.bio,
          portfolioUrl: profile.portfolioUrl,
          school: profile.school,
          phone: profile.phone,
          contactEmail: profile.contactEmail,
          contactEmailVerified: profile.contactEmailVerified,
          pendingContactEmail: profile.pendingContactEmail,
        }}
        demos={demos.map((d) => ({ id: d.id, title: d.title, notes: d.notes }))}
        lumaGuestEmail={lumaLink?.lumaGuestEmail ?? profile.contactEmail}
        avatarUrl={profile.avatarUrl}
        googleImage={user?.image ?? session.user.image ?? null}
      />
    </div>
  );
}
