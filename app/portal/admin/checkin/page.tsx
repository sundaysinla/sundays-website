import { requireAdmin } from "@/lib/admin";
import { getUpcomingCachedEvent, syncUpcomingEvents } from "@/lib/luma-sync";
import { checkinEventChoices, loadCheckinList, syncEventGuests } from "@/lib/attendance";
import { prisma } from "@/lib/db";
import Eyebrow from "@/components/Eyebrow";
import HostTabs from "@/components/portal/HostTabs";
import CheckinList from "@/components/portal/CheckinList";

export const dynamic = "force-dynamic";

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ event?: string }> | { event?: string } }) {
  await requireAdmin();
  const params = await Promise.resolve(searchParams);

  try {
    await syncUpcomingEvents();
  } catch {
    // stale cache is fine
  }

  const choices = await checkinEventChoices();
  let event = params.event ? await prisma.eventCache.findUnique({ where: { lumaEventId: params.event } }) : null;
  if (!event) event = await getUpcomingCachedEvent();
  if (!event && choices[0]) event = await prisma.eventCache.findUnique({ where: { lumaEventId: choices[0].lumaEventId } });

  let syncNote: string | null = null;
  if (event) {
    try {
      await syncEventGuests(event.lumaEventId);
    } catch (e) {
      syncNote = e instanceof Error ? e.message : "Couldn't reach Luma";
    }
  }
  const attendees = event ? await loadCheckinList(event.lumaEventId) : [];

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-4">
        <HostTabs />
        <div className="space-y-3">
          <Eyebrow className="font-ui text-blueberry">Hosts · the door</Eyebrow>
          <h1 className="font-heading text-3xl lowercase leading-tight text-ink md:text-4xl">who&apos;s here</h1>
          <p className="max-w-md font-body text-base text-ink/75">
            Tap a name as people arrive. This is what &ldquo;who did you meet?&rdquo; and the met-graph are built on, so it&apos;s worth keeping honest.
          </p>
          {syncNote ? <p className="font-body text-sm text-ink/55">Luma: {syncNote}</p> : null}
        </div>
      </section>

      {event ? (
        <CheckinList
          eventId={event.lumaEventId}
          eventTitle={`${event.title} · ${event.startAt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Los_Angeles" })}`}
          attendees={attendees}
          choices={choices.map((c) => ({ ...c, startAt: c.startAt.toISOString() }))}
        />
      ) : (
        <p className="font-body text-base text-ink/75">No Sunday on the calendar yet. Once one is on Luma, the RSVP list shows up here.</p>
      )}
    </div>
  );
}
