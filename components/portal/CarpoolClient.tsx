"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import PillToggle from "@/components/portal/PillToggle";
import AddressInput, { inputClass } from "@/components/portal/AddressInput";
import CarpoolMap from "@/components/portal/CarpoolMap";
import CarThread from "@/components/portal/CarThread";
import { formatPhone } from "@/lib/phone";
import { HUBS } from "@/lib/carpool/rideshare";
import type { EventView, MemberCarpool, RideshareRide } from "@/lib/carpool/board";
import type { MemberMap } from "@/lib/carpool/map-types";
import { postCarMessage, upsertCarpoolOffer, withdrawCarpoolOffer } from "@/lib/actions/carpool";
import { cn } from "@/lib/utils";

const label = "font-ui text-[11px] uppercase tracking-wide text-ink/55";
const body = "font-body text-ink/85";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
}

const linkClass = "underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry";

function Phone({ phone }: { phone: string | null }) {
  return phone ? (
    <a href={`tel:${phone}`} className={linkClass}>
      {formatPhone(phone)}
    </a>
  ) : null;
}

/** An Uber group: walk to the meetup spot, meet the others, one person orders. */
function RideshareDetails({ ride, event }: { ride: RideshareRide; event: EventView }) {
  const meet = ride.meetAt ? clock(ride.meetAt) : null;
  const to = event.address ?? event.title;
  return (
    <>
      <p className="font-heading text-2xl lowercase leading-tight text-ink">
        you&apos;re sharing an uber from {ride.hub.name}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className={label}>Meet</dt>
          <dd className={cn(body, "text-base text-ink")}>
            {meet ? `${meet} at ` : ""}
            {ride.hub.name}
          </dd>
          <dd className={cn(body, "text-sm text-ink/55")}>
            {ride.hub.where} · about {ride.walkKm < 1 ? `${Math.round(ride.walkKm * 1000)} m` : `${ride.walkKm.toFixed(1)} km`} from your pickup address
          </dd>
        </div>
        <div>
          <dt className={label}>Who orders it</dt>
          {ride.booker.who === "you" ? (
            <>
              <dd className={cn(body, "text-base text-ink")}>You</dd>
              <dd className={cn(body, "text-sm text-ink/55")}>
                Order an {ride.coRiders.length + 1 > 4 ? "UberXL" : "UberX"} for {ride.coRiders.length + 1} to {to}.
              </dd>
            </>
          ) : ride.booker.who === "rider" ? (
            <>
              <dd className={cn(body, "text-base text-ink")}>{ride.booker.name ?? ride.booker.firstName}</dd>
              {ride.booker.phone ? (
                <dd className={cn(body, "text-sm")}>
                  <Phone phone={ride.booker.phone} />
                </dd>
              ) : null}
            </>
          ) : (
            <dd className={cn(body, "text-base text-ink")}>A host orders it for you</dd>
          )}
        </div>
        {ride.coRiders.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className={label}>Riding with</dt>
            <dd className={cn(body, "text-base text-ink")}>
              {ride.coRiders.map((c, i) => (
                <span key={i}>
                  {i > 0 ? ", " : ""}
                  {c.name ?? c.firstName}
                  {c.phone ? (
                    <span className="text-sm text-ink/55">
                      {" "}
                      (<Phone phone={c.phone} />)
                    </span>
                  ) : null}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className={cn(body, "text-sm text-ink/55")}>
        {ride.status === "confirmed"
          ? `Be at ${ride.hub.name}${meet ? ` by ${meet}` : ""}. Running late or can't make it? Say so in the chat below, or withdraw so hosts can fill your seat.`
          : "Not enough drivers this week, so a host has you pencilled in for a shared Uber. You'll get the final plan by text or email once they confirm it."}
      </p>
    </>
  );
}

export default function CarpoolClient({
  token,
  event,
  data,
  map,
}: {
  token: string | null;
  event: EventView | null;
  data: MemberCarpool;
  map: MemberMap;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<"rider" | "driver">(data.offer?.role ?? "rider");
  const [seats, setSeats] = useState(data.offer?.seatsTotal ?? 2);
  const [editing, setEditing] = useState(!data.offer);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Keep the thread and ride status fresh while someone's in a car.
  const inCar = !!data.ride;
  useEffect(() => {
    if (!inCar) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(t);
  }, [inCar, router]);

  if (!event) {
    return (
      <div className="space-y-3 rounded-[20px] border border-dashed border-ink/25 bg-paper-2 p-6">
        <p className="font-heading text-2xl lowercase text-ink">no sunday on the calendar yet</p>
        <p className={cn(body, "text-sm text-ink/55")}>
          Carpool opens once the next session is posted on Luma. Check back in a day or two.
        </p>
      </div>
    );
  }

  const { offer, ride } = data;
  const venue = event.lat != null && event.lng != null ? { lat: event.lat, lng: event.lng, label: event.address ?? event.title } : null;
  const showMap = !!token && (venue !== null || map.self !== null || map.car !== null || map.ghosts.length > 0);

  return (
    <div className="space-y-12">
      {showMap ? (
        <section className="space-y-3">
          <CarpoolMap
            token={token!}
            venue={venue}
            cars={map.car ? [map.car] : []}
            unassigned={[]}
            self={map.self}
            ghosts={map.ghosts}
            className="h-[340px] w-full overflow-hidden rounded-[24px] border border-ink/15 bg-paper-2 md:h-[400px]"
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-2.5 w-2.5 rotate-45 border border-ink bg-lime" /> venue</span>
            {map.self ? <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-3 w-3 rounded-full border-2 border-lime bg-ink" /> you</span> : null}
            {map.car?.hub ? (
              <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-ink text-[8px] text-lime">U</span> meetup spot</span>
            ) : map.car ? (
              <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-3 w-3 rounded-full bg-ink" /> your car</span>
            ) : null}
            {map.ghosts.length > 0 ? <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-3 w-3 rounded-full border border-blueberry/40 bg-blueberry-200/70" /> others, to the nearest kilometer</span> : null}
          </div>
        </section>
      ) : null}

      {/* the ride, if there is one */}
      {ride ? (
        <section className="space-y-4 rounded-[24px] border border-ink/15 bg-paper-2 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={label}>Your ride</h2>
            <span className={cn("rounded-full px-2.5 pt-[4px] pb-[3px] font-ui text-[10px] uppercase tracking-wide", ride.status === "confirmed" ? "bg-lime/70 text-ink/85" : "bg-paper-2 text-ink/55")}>
              {ride.status === "confirmed" ? (ride.changed ? "Updated" : "Set") : "Being arranged"}
            </span>
          </div>

          {ride.kind === "rideshare" ? (
            <RideshareDetails ride={ride} event={event} />
          ) : ride.kind === "rider" ? (
            <>
              <p className="font-heading text-2xl lowercase leading-tight text-ink">
                you&apos;re stop {ride.stopNumber} of {ride.stopCount} in {ride.driver.firstName}&apos;s car
              </p>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className={label}>Driver</dt>
                  <dd className={cn(body, "text-base text-ink")}>
                    {ride.driver.name ?? ride.driver.firstName}
                    {ride.driver.neighborhood ? <span className="text-ink/55"> · from {ride.driver.neighborhood}</span> : null}
                  </dd>
                  {ride.driver.email ? (
                    <dd className={cn(body, "text-sm")}>
                      <a href={`mailto:${ride.driver.email}`} className="underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry">{ride.driver.email}</a>
                    </dd>
                  ) : null}
                  {ride.driver.phone ? (
                    <dd className={cn(body, "text-sm")}>
                      <a href={`tel:${ride.driver.phone}`} className="underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry">{formatPhone(ride.driver.phone)}</a>
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className={label}>Pickup</dt>
                  <dd className={cn(body, "text-base text-ink")}>{offer?.address}</dd>
                  <dd className={cn(body, "text-sm text-ink/55")}>to {event.address ?? event.title}</dd>
                </div>
                {ride.coRiders.length > 0 ? (
                  <div className="sm:col-span-2">
                    <dt className={label}>Also riding</dt>
                    <dd className={cn(body, "text-base text-ink")}>
                      {ride.coRiders.map((c) => `${c.firstName}${c.neighborhood ? ` (${c.neighborhood})` : ""}`).join(", ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className={cn(body, "text-sm text-ink/55")}>
                {ride.status === "confirmed"
                  ? "Your driver has your address. If plans change, withdraw below so hosts can re-seat the car."
                  : "A host has you pencilled in. You'll get an email with your driver's details once they confirm the car."}
              </p>
            </>
          ) : (
            <>
              <p className="font-heading text-2xl lowercase leading-tight text-ink">
                {ride.stops.length === 0
                  ? "no riders yet"
                  : `you're driving ${ride.stops.length} ${ride.stops.length === 1 ? "person" : "people"}`}
              </p>
              {ride.stops.length > 0 ? (
                <ol className="divide-y divide-dashed divide-ink/12">
                  {ride.stops.map((s) => (
                    <li key={s.order} className="flex items-start gap-3 py-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white font-ui text-[10px]">{s.order + 1}</span>
                      <div className="min-w-0">
                        <p className={cn(body, "text-base text-ink")}>
                          {s.name ?? s.firstName}
                          {s.neighborhood ? <span className="text-ink/55"> · {s.neighborhood}</span> : null}
                        </p>
                        {s.address ? <p className={cn(body, "text-sm text-ink/55")}>{s.address}</p> : null}
                        {s.email || s.phone ? (
                          <p className={cn(body, "flex flex-wrap gap-x-3 text-sm")}>
                            {s.email ? <a href={`mailto:${s.email}`} className="underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry">{s.email}</a> : null}
                            {s.phone ? <a href={`tel:${s.phone}`} className="underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry">{formatPhone(s.phone)}</a> : null}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : null}
              <p className={cn(body, "text-sm text-ink/55")}>
                {ride.stops.length > 0 ? `About ${ride.routeKm.toFixed(0)} km with pickups, ${ride.detourKm.toFixed(1)} km more than driving straight there. ` : ""}
                {ride.status === "confirmed"
                  ? "Stop order and addresses are final unless a host sends a change."
                  : "Hosts are filling seats. Full names and addresses appear once they confirm the car."}
              </p>
            </>
          )}

          <div className="space-y-3 border-t border-dashed border-ink/12 pt-4">
            <div className="flex items-baseline justify-between">
              <h3 className={label}>{ride.kind === "rideshare" ? "Uber chat" : "Car chat"}</h3>
              <span className={cn(label, "text-ink/55")}>everyone in the {ride.kind === "rideshare" ? "group" : "car"} gets a text or email</span>
            </div>
            <CarThread carId={ride.carId} messages={ride.messages} post={postCarMessage} myOfferId={offer?.id ?? null} />
          </div>
        </section>
      ) : offer ? (
        <section className="space-y-2 rounded-[24px] border border-dashed border-ink/25 bg-paper-2 p-6">
          <h2 className={label}>Your ride</h2>
          <p className="font-heading text-2xl lowercase leading-tight text-ink">
            {offer.role === "driver" ? "you're on the board as a driver" : "you're on the list for a ride"}
          </p>
          <p className={cn(body, "text-sm text-ink/55")}>
            {offer.role === "driver"
              ? `Hosts will fill your ${offer.seatsTotal ?? 1} seat${offer.seatsTotal === 1 ? "" : "s"} and email you the pickup order.`
              : `Hosts match riders to cars a day or two before Sunday and email you the details. If there aren't enough drivers, you might share an Uber from ${HUBS.map((h) => h.name).join(" or ")} instead.`}
          </p>
        </section>
      ) : null}

      {/* the offer */}
      <section className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className={label}>{offer ? "Your details" : "Join this week's carpool"}</h2>
          {offer && !editing ? (
            <button type="button" onClick={() => setEditing(true)} className="font-ui text-[11px] uppercase text-ink underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry">
              Edit
            </button>
          ) : null}
        </div>

        {offer && !editing ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className={label}>{offer.role === "driver" ? "Driving from" : "Pickup"}</dt>
              <dd className={cn(body, "text-base text-ink")}>{offer.address}</dd>
            </div>
            {offer.role === "driver" ? (
              <div>
                <dt className={label}>Seats</dt>
                <dd className={cn(body, "text-base text-ink")}>{offer.seatsTotal}</dd>
              </div>
            ) : null}
            <div>
              <dt className={label}>Phone</dt>
              <dd className={cn(body, "text-base text-ink")}>{data.phone ? formatPhone(data.phone) : <span className="text-ink/55">none — add one for texts</span>}</dd>
            </div>
            {offer.notes ? (
              <div className="sm:col-span-2">
                <dt className={label}>Notes</dt>
                <dd className={cn(body, "text-base text-ink")}>{offer.notes}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              setNotice(null);
              const f = new FormData(e.currentTarget);
              f.set("role", role);
              f.set("seatsTotal", String(seats));
              startTransition(async () => {
                const r = await upsertCarpoolOffer(f);
                if (r.ok) {
                  setNotice({ tone: "ok", text: offer ? "Updated." : "You're on the board." });
                  setEditing(false);
                  router.refresh();
                } else {
                  setNotice({ tone: "error", text: r.error });
                }
              });
            }}
          >
            <PillToggle
              aria-label="Need a ride or can drive"
              value={role}
              onChange={setRole}
              options={[
                { value: "rider", label: "I need a ride" },
                { value: "driver", label: "I can drive" },
              ]}
            />

            <label className="block space-y-2">
              <span className={label}>{role === "driver" ? "Where you'll start from" : "Where to pick you up"}</span>
              <AddressInput
                token={token}
                required
                defaultValue={offer?.address ?? ""}
                defaultCoords={offer ? { lat: offer.lat, lng: offer.lng, neighborhood: offer.neighborhood } : null}
                placeholder="Street address, dorm, or a landmark"
              />
              <span className={cn(body, "block text-xs text-ink/55")}>
                Other members only see your neighborhood until a host confirms your car.
              </span>
            </label>

            <label className="block space-y-2">
              <span className={label}>Phone (optional)</span>
              <input
                name="phone"
                type="tel"
                defaultValue={data.phone ? formatPhone(data.phone) : ""}
                placeholder="(310) 555-0101"
                className={inputClass}
              />
              <span className={cn(body, "block text-xs text-ink/55")}>
                For texts about your ride and last-minute changes. Shared with your car once a host confirms it.
              </span>
            </label>

            {role === "driver" ? (
              <div className="flex items-center gap-3">
                <span className={label}>Seats for riders</span>
                <button type="button" aria-label="Fewer seats" onClick={() => setSeats((s) => Math.max(1, s - 1))} className="h-9 w-9 rounded-full border border-ink/15 bg-white font-ui hover:bg-blueberry-200/30">−</button>
                <span className="w-6 text-center font-body text-lg tabular-nums">{seats}</span>
                <button type="button" aria-label="More seats" onClick={() => setSeats((s) => Math.min(8, s + 1))} className="h-9 w-9 rounded-full border border-ink/15 bg-white font-ui hover:bg-blueberry-200/30">+</button>
              </div>
            ) : null}

            <label className="block space-y-2">
              <span className={label}>Anything hosts should know (optional)</span>
              <input name="notes" defaultValue={offer?.notes ?? ""} placeholder="Leaving USC Village around 1:15, can take a bike…" className={inputClass} />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="dark" size="md" disabled={pending}>
                {pending ? "Saving…" : offer ? "Save changes" : role === "driver" ? "Offer seats" : "Ask for a ride"}
              </Button>
              {offer ? (
                <Button type="button" variant="ghost" size="md" disabled={pending} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        )}

        {notice ? (
          <p className={cn(body, "text-sm", notice.tone === "error" ? "text-red-700" : "text-ink/75")} role="status">
            {notice.text}
          </p>
        ) : null}

        {offer ? (
          <div className="border-t border-dashed border-ink/15 pt-5">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(ride?.status === "confirmed" ? "Withdraw? Your car will be told and hosts will re-seat it." : "Withdraw from this week's carpool?")) return;
                startTransition(async () => {
                  const r = await withdrawCarpoolOffer();
                  if (r.ok) {
                    setNotice({ tone: "ok", text: "You're off this week's board." });
                    setEditing(true);
                    router.refresh();
                  } else setNotice({ tone: "error", text: r.error });
                });
              }}
              className="font-ui text-[11px] uppercase text-ink/55 hover:text-ink"
            >
              Withdraw for this week
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
