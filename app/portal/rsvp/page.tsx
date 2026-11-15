import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureProfile } from "@/lib/profile";
import {
  getUpcomingCachedEvent,
  syncUpcomingEvents,
  syncUserAttendance,
} from "@/lib/luma-sync";
import Eyebrow from "@/components/Eyebrow";
import RsvpForm from "@/components/portal/RsvpForm";
import LumaEmbed from "@/components/portal/LumaEmbed";

export default async function RsvpPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/login");

  await ensureProfile(session.user.id, session.user);

  let syncError: string | null = null;
  try {
    await syncUpcomingEvents();
    await syncUserAttendance(session.user.id);
  } catch (e) {
    syncError = e instanceof Error ? e.message : "Luma sync failed";
  }

  const [event, demos, attendance] = await Promise.all([
    getUpcomingCachedEvent(),
    prisma.demoHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    (async () => {
      const upcoming = await getUpcomingCachedEvent();
      if (!upcoming) return null;
      return prisma.attendance.findUnique({
        where: {
          userId_lumaEventId: {
            userId: session.user!.id!,
            lumaEventId: upcoming.lumaEventId,
          },
        },
      });
    })(),
  ]);

  const alreadyGoing =
    attendance?.status === "going" || attendance?.status === "approved";

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-16">
      <div className="max-w-2xl space-y-10">
      <section className="space-y-3">
        <Eyebrow>RSVP</Eyebrow>
        <h1 className="font-['Office-Times-Sharp-Regular'] text-3xl lowercase text-[#010101] md:text-4xl">
          this sunday
        </h1>
        {event ? (
          <div className="space-y-1">
            <p className="font-['Office-Times-Round'] text-lg text-[#2A2A24]">
              {event.title}
            </p>
            <p className="font-['Office-Times-Round'] text-sm text-[#8a8478]">
              {event.startAt.toLocaleString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {event.address ? ` · ${event.address}` : ""}
            </p>
          </div>
        ) : (
          <p className="font-['Office-Times-Round'] text-base text-[#3A372F]">
            We couldn&apos;t load the next event yet.
          </p>
        )}
        {syncError && (
          <p className="font-['Office-Times-Round'] text-sm text-[#8a8478]">
            Sync note: {syncError}
          </p>
        )}
      </section>

      <RsvpForm
        demos={demos.map((d) => ({ id: d.id, title: d.title }))}
        alreadyGoing={!!alreadyGoing}
        lumaUrl={event?.lumaUrl ?? "https://luma.com/sundaysinla"}
        hasEvent={!!event}
      />
      </div>

      {event ? (
        <LumaEmbed
          lumaEventId={event.lumaEventId}
          lumaUrl={event.lumaUrl}
          title={event.title}
          coverUrl={event.coverUrl}
        />
      ) : null}
    </div>
  );
}
