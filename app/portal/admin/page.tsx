import { requireAdmin } from "@/lib/admin";
import { getUpcomingCachedEvent, syncUpcomingEvents } from "@/lib/luma-sync";
import { loadHostBoard } from "@/lib/carpool/board";
import { ensureCarsForEvent, getVenue, recentEventChanges } from "@/lib/carpool/service";
import { publicMapboxToken } from "@/lib/geo";
import Eyebrow from "@/components/Eyebrow";
import HostBoard from "@/components/portal/HostBoard";
import { adminMoveCarpool, adminSyncLuma } from "@/lib/actions/admin";
import Button from "@/components/Button";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

export default async function AdminPage() {
  await requireAdmin();

  let syncError: string | null = null;
  try {
    await syncUpcomingEvents();
  } catch (e) {
    syncError = e instanceof Error ? e.message : "Luma sync failed";
  }

  const event = await getUpcomingCachedEvent();
  if (event) {
    try {
      await ensureCarsForEvent(event.lumaEventId, await getVenue(event.lumaEventId));
    } catch {
      // board still loads; cars get created on the next action
    }
  }
  const board = event ? await loadHostBoard(event.lumaEventId) : null;
  const changes = await recentEventChanges(event?.lumaEventId ?? null);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <Eyebrow>Hosts · carpool</Eyebrow>
          <h1 className="font-['Office-Times-Sharp-Regular'] text-3xl lowercase leading-tight text-[#010101] md:text-4xl">
            this week&apos;s cars
          </h1>
          {event ? (
            <p className="font-['Office-Times-Round'] text-base text-[#3A372F]">
              {event.title} · {fmt(event.startAt)}
              {event.address ? <span className="text-[#8a8478]"> · {event.address}</span> : null}
            </p>
          ) : (
            <p className="font-['Office-Times-Round'] text-base text-[#3A372F]">
              No upcoming Sundays is on Luma yet. Post the event, then sync.
            </p>
          )}
          {syncError ? (
            <p className="font-['Office-Times-Round'] text-sm text-[#8a8478]">Luma: {syncError}</p>
          ) : null}
        </div>
        {!event ? (
          <form
            action={async () => {
              "use server";
              await adminSyncLuma();
            }}
          >
            <Button type="submit" variant="dark" size="md">
              Sync Luma
            </Button>
          </form>
        ) : null}
      </section>

      {changes.length > 0 ? (
        <section className="space-y-3 rounded-[20px] border border-dashed border-[#C0B9A5] bg-[#FCFAF7] p-5">
          <p className="font-['Monument-Grotesk'] text-[10px] uppercase tracking-wide text-[#C0B9A5]">Luma changes</p>
          {changes.map((c) => (
            <div key={c.lumaEventId} className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl font-['Office-Times-Round'] text-base text-[#2A2A24]">
                {c.replacedBy && event && c.replacedBy === event.lumaEventId ? (
                  <>
                    <span className="text-[#010101]">“{c.title}”</span> was {c.status === "deleted" ? "deleted" : "taken off the calendar"} on Luma, so its carpool entries were moved to this event.
                    RSVPs don&apos;t carry over — Luma&apos;s guest list started fresh, so ask people to RSVP again.
                  </>
                ) : (
                  <>
                    <span className="text-[#010101]">“{c.title}”</span> is gone from Luma, but {c.waiting} {c.waiting === 1 ? "person is" : "people are"} still on its carpool.{" "}
                    {event
                      ? "Move them onto this week's event, or leave them if that Sunday really is off."
                      : "They'll move over automatically once the replacement shows up on Luma within a day and a half of the old time."}
                  </>
                )}
              </p>
              {event && c.waiting > 0 && c.replacedBy !== event.lumaEventId ? (
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    await adminMoveCarpool(fd);
                  }}
                >
                  <input type="hidden" name="fromId" value={c.lumaEventId} />
                  <Button type="submit" variant="dark" size="sm">
                    Move them here
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {board ? <HostBoard board={board} token={publicMapboxToken()} /> : null}
    </div>
  );
}
