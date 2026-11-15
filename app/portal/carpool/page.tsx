import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/profile";
import { getUpcomingCachedEvent, syncUpcomingEvents } from "@/lib/luma-sync";
import { eventView, loadMemberCarpool, loadMemberMap } from "@/lib/carpool/board";
import { ensureCarsForEvent, getVenue } from "@/lib/carpool/service";
import { publicMapboxToken } from "@/lib/geo";
import Eyebrow from "@/components/Eyebrow";
import CarpoolClient from "@/components/portal/CarpoolClient";

export const dynamic = "force-dynamic";

export default async function CarpoolPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/login");

  await ensureProfile(session.user.id, session.user);

  try {
    await syncUpcomingEvents();
  } catch {
    // stale cache is fine
  }

  const event = await getUpcomingCachedEvent();
  if (event) {
    try {
      await ensureCarsForEvent(event.lumaEventId, await getVenue(event.lumaEventId));
    } catch {
      // non-fatal
    }
  }
  const [data, map] = event
    ? await Promise.all([
        loadMemberCarpool(session.user.id, event.lumaEventId),
        loadMemberMap(session.user.id, event.lumaEventId),
      ])
    : [{ offer: null, ride: null, phone: null }, { self: null, car: null, ghosts: [] }];

  const startAt = event
    ? event.startAt.toLocaleString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Los_Angeles",
      })
    : null;

  return (
    <div className="max-w-2xl space-y-10">
      <section className="space-y-3">
        <Eyebrow className="font-ui text-blueberry">Carpool</Eyebrow>
        <h1 className="font-heading text-3xl lowercase leading-tight text-ink md:text-4xl">
          across campus
        </h1>
        <p className="max-w-md font-body text-base text-ink/75">
          Say whether you need a ride or can drive. Hosts group cars by route a day or two before Sunday and email you the details.
        </p>
        {event ? (
          <p className="font-body text-sm text-ink/55">
            {event.title} · {startAt}
            {event.address ? ` · ${event.address}` : ""}
          </p>
        ) : null}
      </section>

      <CarpoolClient token={publicMapboxToken()} event={event ? eventView(event) : null} data={data} map={map} />
    </div>
  );
}
