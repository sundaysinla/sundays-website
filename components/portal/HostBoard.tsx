"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import PillToggle from "@/components/portal/PillToggle";
import AddressInput, { inputClass } from "@/components/portal/AddressInput";
import CarpoolMap, { carColor, type HubPin, type MapCar } from "@/components/portal/CarpoolMap";
import CarThread from "@/components/portal/CarThread";
import ImportSheet from "@/components/portal/ImportSheet";
import { formatPhone } from "@/lib/phone";
import type { CarView, HostBoard as Board, HubView, PersonView } from "@/lib/carpool/board";
import { MAX_WALK_KM, UBER_MAX_SEATS } from "@/lib/carpool/rideshare";
import {
  adminConfirmCar,
  adminCreateRideshare,
  adminMovePin,
  adminOptimizeCar,
  adminPlaceRider,
  adminPostCarMessage,
  adminRemoveOffer,
  adminRemoveRideshare,
  adminReorderCar,
  adminSetSeats,
  adminSuggest,
  adminSyncLuma,
  adminUberTheRest,
  adminUnplaceRider,
  adminUpdateRideshare,
  adminWriteIn,
} from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

const label = "font-ui text-[10px] uppercase tracking-wide text-ink/55";
const body = "font-body text-ink/85";

function km(n: number) {
  return `${n.toFixed(1)} km`;
}

function Chip({ tone, children }: { tone: "ok" | "warn" | "muted" | "ink"; children: React.ReactNode }) {
  const tones = {
    ok: "bg-lime/60 text-ink/85",
    warn: "bg-paper-2 text-ink/55",
    muted: "bg-transparent text-ink/55 border border-dashed border-ink/15",
    ink: "bg-ink text-paper",
  };
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 pt-[3px] pb-[2px] font-ui text-[9px] uppercase tracking-wide", tones[tone])}>
      {children}
    </span>
  );
}

function PersonLine({ p, showAddress = true }: { p: PersonView; showAddress?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cn(body, "truncate text-base text-ink")}>
        {p.name}
        {p.guest ? <span className="ml-2 font-ui text-[9px] uppercase text-ink/55">write-in</span> : null}
      </p>
      <p className={cn(body, "truncate text-sm text-ink/55")}>
        {p.neighborhood ? `${p.neighborhood}` : ""}
        {showAddress ? `${p.neighborhood ? " · " : ""}${p.address}` : ""}
      </p>
      {p.phone ? (
        <a href={`tel:${p.phone}`} className={cn(body, "block text-xs text-ink/55 hover:text-ink")}>
          {formatPhone(p.phone)}
        </a>
      ) : null}
      {p.notes ? <p className={cn(body, "text-sm italic text-ink/55")}>“{p.notes}”</p> : null}
    </div>
  );
}

export default function HostBoard({ board, token }: { board: Board; token: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [placing, setPlacing] = useState<string | null>(null); // riderOfferId with the "place in…" menu open
  const [editPin, setEditPin] = useState<string | null>(null); // offerId whose map pin may be dragged

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of board.cars) {
      if (c.driver) m.set(c.driver.offerId, c.driver.firstName);
      for (const s of c.stops) m.set(s.rider.offerId, s.rider.firstName);
    }
    for (const u of board.unassigned) m.set(u.offerId, u.firstName);
    return m;
  }, [board]);

  const fixPin = (offerId: string) => (
    <button
      type="button"
      disabled={pending}
      onClick={() => setEditPin(editPin === offerId ? null : offerId)}
      className={cn(
        "font-ui text-[10px] uppercase underline-offset-4",
        editPin === offerId ? "text-ink underline decoration-lime decoration-2" : "text-ink/55 hover:text-ink"
      )}
      title="Drag this person's pin on the map"
    >
      {editPin === offerId ? "Done" : "Fix pin"}
    </button>
  );

  const run = useCallback(
    (fn: () => Promise<Result>, okText?: string) => {
      setNotice(null);
      startTransition(async () => {
        const r = await fn();
        if (r.ok) {
          if (okText) setNotice({ tone: "ok", text: okText });
          router.refresh();
        } else {
          setNotice({ tone: "error", text: r.error });
        }
      });
    },
    [router]
  );

  const fd = (obj: Record<string, string | number | undefined | null>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(obj)) if (v != null && v !== "") f.set(k, String(v));
    return f;
  };

  const colorOf = useMemo(() => new Map(board.cars.map((c, i) => [c.id, carColor(i)])), [board.cars]);

  const mapCars: MapCar[] = board.cars.map((c) => ({
    id: c.id,
    color: colorOf.get(c.id)!,
    driver: c.driver ? { offerId: c.driver.offerId, lat: c.driver.lat, lng: c.driver.lng, name: c.driver.name } : null,
    hub: c.hub ? { lat: c.hub.lat, lng: c.hub.lng, label: c.hub.name } : null,
    stops: c.stops.map((s) => ({ offerId: s.rider.offerId, lat: s.rider.lat, lng: s.rider.lng, name: s.rider.name, order: s.order, confirmed: s.confirmed })),
  }));
  const hubPins: HubPin[] = board.hubs.map((h) => ({ lat: h.lat, lng: h.lng, label: h.name }));
  const drives = board.cars.filter((c) => c.kind === "drive");
  const ubers = board.cars.filter((c) => c.kind === "rideshare");

  const venue =
    board.event.lat != null && board.event.lng != null
      ? { lat: board.event.lat, lng: board.event.lng, label: board.event.address ?? board.event.title }
      : null;

  // ── drag & drop of riders between the unassigned list and cars ──
  const onDragStart = (e: React.DragEvent, riderOfferId: string) => {
    e.dataTransfer.setData("text/rider", riderOfferId);
    e.dataTransfer.effectAllowed = "move";
  };
  const dropOnCar = (e: React.DragEvent, carId: string) => {
    e.preventDefault();
    setDragOver(null);
    const riderOfferId = e.dataTransfer.getData("text/rider");
    if (!riderOfferId) return;
    run(() => adminPlaceRider(fd({ riderOfferId, carId })));
  };
  const dropOnUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const riderOfferId = e.dataTransfer.getData("text/rider");
    if (!riderOfferId) return;
    run(() => adminUnplaceRider(fd({ riderOfferId })));
  };

  const placeMenu = (riderOfferId: string, excludeCarId?: string) => (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {board.cars
        .filter((c) => c.id !== excludeCarId)
        .map((c) => {
          const full = c.stops.length >= c.seatsTotal;
          return (
            <button
              key={c.id}
              type="button"
              disabled={pending || full}
              onClick={() => {
                setPlacing(null);
                run(() => adminPlaceRider(fd({ riderOfferId, carId: c.id })));
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-2.5 pt-1 pb-[3px] font-ui text-[10px] uppercase text-ink/85 hover:bg-blueberry-200/30 disabled:opacity-40"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: colorOf.get(c.id) }} />
              {c.label}
              <span className="text-ink/55">{c.stops.length}/{c.seatsTotal}</span>
            </button>
          );
        })}
      {board.cars.length <= (excludeCarId ? 1 : 0) ? <span className={cn(body, "text-sm text-ink/55")}>No other cars or Ubers yet.</span> : null}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* summary + primary actions */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-dashed border-ink/15 pt-6">
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          {[
            ["Cars", board.counts.drivers],
            ...(board.counts.ubers > 0 ? [["Ubers", board.counts.ubers]] : []),
            ["Riders", board.counts.riders],
            ["Seated", `${board.counts.seated} / ${board.counts.seats}`],
            ["Unassigned", board.unassigned.length],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className={label}>{k}</dt>
              <dd className="font-heading text-2xl text-ink tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => adminSyncLuma(), "Synced from Luma.")}>
            Sync Luma
          </Button>
          <Button
            type="button"
            variant="dark"
            size="md"
            disabled={pending || board.cars.length === 0 || board.unassigned.length === 0}
            onClick={() =>
              run(async () => {
                const r = await adminSuggest();
                if (r.ok)
                  setNotice({
                    tone: "ok",
                    text: `Suggested ${r.placed ?? 0} placement${r.placed === 1 ? "" : "s"}${r.unplaced ? `, ${r.unplaced} still need a ride. Short on drivers? “Uber the rest” groups them at De Neve and USC Village.` : "."}`,
                  });
                return r;
              })
            }
          >
            Suggest placements
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={pending || board.unassigned.length === 0}
            onClick={() =>
              run(async () => {
                const r = await adminUberTheRest();
                if (r.ok) {
                  const made = r.groups ? ` (${r.groups} new Uber${r.groups === 1 ? "" : "s"})` : "";
                  const far = r.skipped?.length
                    ? ` ${r.skipped.join(", ")} ${r.skipped.length === 1 ? "is" : "are"} more than ${MAX_WALK_KM} km from both meetup spots — place them by hand.`
                    : "";
                  setNotice({ tone: "ok", text: `Put ${r.placed ?? 0} rider${r.placed === 1 ? "" : "s"} in Ubers${made}.${far}` });
                }
                return r;
              })
            }
          >
            Uber the rest
          </Button>
        </div>
      </div>

      {notice ? (
        <p className={cn(body, "text-sm", notice.tone === "error" ? "text-red-700" : "text-ink/75")} role="status">
          {notice.text}
        </p>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-y-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-16">
        {/* map */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          {editPin ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-lime/60 px-4 py-2.5">
              <p className={cn(body, "text-sm text-ink")}>
                Drag <strong>{nameOf.get(editPin) ?? "this"}</strong>&apos;s pin to the right spot. You&apos;ll be asked to confirm before it saves.
              </p>
              <button type="button" onClick={() => setEditPin(null)} className="font-ui text-[10px] uppercase text-ink underline underline-offset-4">
                Cancel
              </button>
            </div>
          ) : null}
          {token ? (
            <CarpoolMap
              token={token}
              venue={venue}
              cars={mapCars}
              hubs={hubPins}
              unassigned={board.unassigned.map((u) => ({ offerId: u.offerId, lat: u.lat, lng: u.lng, name: u.name }))}
              selectedCarId={selected}
              onSelectCar={setSelected}
              editablePinId={editPin}
              onPinMove={async (offerId, lat, lng) => {
                const who = nameOf.get(offerId) ?? "this person";
                if (!confirm(`Move ${who}'s pin here? The address will update to the nearest street.`)) return false;
                const r = await adminMovePin(fd({ offerId, lat, lng }));
                if (!r.ok) {
                  setNotice({ tone: "error", text: r.error });
                  return false;
                }
                setEditPin(null);
                setNotice({ tone: "ok", text: `${who}'s pin moved.` });
                router.refresh();
                return true;
              }}
              className="h-[52vh] w-full overflow-hidden rounded-[24px] border border-ink/15 bg-paper-2 lg:h-[calc(100vh-8rem)]"
            />
          ) : (
            <div className="flex h-[40vh] items-center justify-center rounded-[24px] border border-dashed border-ink/25 bg-paper-2 p-8 text-center">
              <p className={cn(body, "max-w-sm text-sm text-ink/55")}>
                Set a public <code>pk.</code> Mapbox token as <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> (or <code>MAPBOX_TOKEN</code>) to see the map.
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-2.5 w-2.5 rotate-45 border border-ink bg-lime" /> venue</span>
            <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-3 w-3 rounded-full bg-ink" /> driver</span>
            <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-3 w-3 rounded-full border-2 border-ink bg-white" /> stop</span>
            <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-ink/25 bg-white" /> unassigned</span>
            <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-ink text-[8px] text-lime">U</span> uber meetup</span>
            <span className={cn(label, "text-ink/55")}>use “fix pin” next to a name to move their pin</span>
          </div>
        </div>

        {/* lists */}
        <div className="space-y-10">
          {/* unassigned */}
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver("unassigned");
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={dropOnUnassigned}
            className={cn("space-y-3 rounded-[20px] border border-dashed p-4 transition-colors", dragOver === "unassigned" ? "border-ink bg-paper-2" : "border-ink/15")}
          >
            <div className="flex items-baseline justify-between">
              <h2 className={label}>Needs a ride · {board.unassigned.length}</h2>
              <span className={cn(label, "text-ink/55")}>drop here to unassign</span>
            </div>
            {board.unassigned.length === 0 ? (
              <p className={cn(body, "text-sm text-ink/55")}>Everyone who asked for a ride is in a car.</p>
            ) : (
              <ul className="divide-y divide-dashed divide-ink/12">
                {board.unassigned.map((r) => (
                  <li key={r.offerId} draggable onDragStart={(e) => onDragStart(e, r.offerId)} className="cursor-grab space-y-1 py-3 active:cursor-grabbing">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <PersonLine p={r} />
                        {r.nearHub && r.nearHub.km <= 5 ? (
                          <p className={cn(label, "mt-0.5", r.nearHub.km > MAX_WALK_KM ? "text-ink/40" : "")}>
                            {km(r.nearHub.km)} from {r.nearHub.name}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" disabled={pending || board.cars.length === 0} onClick={() => setPlacing(placing === r.offerId ? null : r.offerId)} className="font-ui text-[10px] uppercase text-ink underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry disabled:opacity-40">
                          Place
                        </button>
                        {fixPin(r.offerId)}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (confirm(`Remove ${r.name} from this week's board?`)) run(() => adminRemoveOffer(fd({ offerId: r.offerId })));
                          }}
                          className="font-ui text-[10px] uppercase text-ink/55 hover:text-ink"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {placing === r.offerId ? placeMenu(r.offerId) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* cars */}
          <section className="space-y-4">
            <h2 className={label}>Cars · {drives.length}</h2>
            {drives.length === 0 ? (
              <p className={cn(body, "text-sm text-ink/55")}>No drivers yet. Write one in below, or wait for members to offer.</p>
            ) : (
              drives.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  color={colorOf.get(car.id)!}
                  selected={selected === car.id}
                  onSelect={() => setSelected(selected === car.id ? null : car.id)}
                  dragOver={dragOver === car.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(car.id);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => dropOnCar(e, car.id)}
                  onDragStartRider={onDragStart}
                  pending={pending}
                  run={run}
                  fd={fd}
                  placing={placing}
                  setPlacing={setPlacing}
                  placeMenu={placeMenu}
                  fixPin={fixPin}
                />
              ))
            )}
          </section>

          {/* ubers */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={label}>Ubers · {ubers.length}</h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn(label, "text-ink/40")}>new from</span>
                {board.hubs.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => adminCreateRideshare(fd({ hubId: h.id })), `New Uber from ${h.name}. Drag riders into it.`)}
                    className="rounded-full border border-ink/15 bg-white px-2.5 pt-1 pb-[3px] font-ui text-[10px] uppercase text-ink/85 hover:bg-blueberry-200/30 disabled:opacity-40"
                  >
                    + {h.name}
                  </button>
                ))}
              </div>
            </div>
            {ubers.length === 0 ? (
              <p className={cn(body, "text-sm text-ink/55")}>
                Short on drivers? Riders can walk to {board.hubs.map((h) => h.name).join(" or ")} and share an Uber. “Uber the rest” groups everyone still without a ride by their nearest spot.
              </p>
            ) : (
              ubers.map((car) => (
                <UberCard
                  key={car.id}
                  car={car}
                  hubs={board.hubs}
                  color={colorOf.get(car.id)!}
                  selected={selected === car.id}
                  onSelect={() => setSelected(selected === car.id ? null : car.id)}
                  dragOver={dragOver === car.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(car.id);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => dropOnCar(e, car.id)}
                  onDragStartRider={onDragStart}
                  pending={pending}
                  run={run}
                  fd={fd}
                  placing={placing}
                  setPlacing={setPlacing}
                  placeMenu={placeMenu}
                  fixPin={fixPin}
                />
              ))
            )}
          </section>

          <WriteIn token={token} cars={board.cars} colorOf={colorOf} pending={pending} run={run} />
          <ImportSheet />
        </div>
      </div>
    </div>
  );
}

type CardProps = {
  car: CarView;
  color: string;
  selected: boolean;
  onSelect: () => void;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStartRider: (e: React.DragEvent, riderOfferId: string) => void;
  pending: boolean;
  run: (fn: () => Promise<Result>, okText?: string) => void;
  fd: (o: Record<string, string | number | undefined | null>) => FormData;
  placing: string | null;
  setPlacing: (v: string | null) => void;
  placeMenu: (riderOfferId: string, excludeCarId?: string) => React.ReactNode;
  fixPin: (offerId: string) => React.ReactNode;
};

function carStatus(car: CarView) {
  return car.confirmedAt ? (car.changedAt || car.pendingStops > 0 ? "changed" : "confirmed") : "draft";
}

function StatusChip({ status }: { status: ReturnType<typeof carStatus> }) {
  return status === "confirmed" ? <Chip tone="ok">Confirmed</Chip> : status === "changed" ? <Chip tone="warn">Changed</Chip> : <Chip tone="muted">Not sent</Chip>;
}

function CarMessages({ car }: { car: CarView }) {
  const [open, setOpen] = useState(false);
  if (car.stops.length === 0) return null;
  return (
    <div className="space-y-3 border-t border-dashed border-ink/12 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between font-ui text-[10px] uppercase tracking-wide text-ink"
        aria-expanded={open}
      >
        <span>
          Messages · {car.messages.length}
          {car.messages.length > 0 ? (
            <span className="ml-2 normal-case tracking-normal text-ink/55">
              last from {car.messages[car.messages.length - 1].authorFirstName}
            </span>
          ) : null}
        </span>
        <span className="text-ink/55">{open ? "hide" : "open"}</span>
      </button>
      {open ? (
        <CarThread
          carId={car.id}
          messages={car.messages}
          post={adminPostCarMessage}
          compact
          placeholder={car.kind === "rideshare" ? "Post as a host — everyone in the Uber is told." : "Post as a host — everyone in the car is told."}
          emptyText={car.kind === "rideshare" ? "No messages in this Uber yet." : "No messages in this car yet."}
        />
      ) : null}
    </div>
  );
}

function SeatStepper({ car, max, pending, run, fd }: Pick<CardProps, "car" | "pending" | "run" | "fd"> & { max: number }) {
  const set = (n: number) => run(() => adminSetSeats(fd({ carId: car.id, seatsTotal: n })));
  return (
    <div className="flex items-center gap-2">
      <span className={label}>Seats</span>
      <button type="button" aria-label="Fewer seats" disabled={pending || car.seatsTotal <= 1} onClick={() => set(car.seatsTotal - 1)} className="h-7 w-7 rounded-full border border-ink/15 bg-white font-ui text-[12px] hover:bg-blueberry-200/30 disabled:opacity-30">−</button>
      <span className="w-4 text-center font-body text-base tabular-nums">{car.seatsTotal}</span>
      <button type="button" aria-label="More seats" disabled={pending || car.seatsTotal >= max} onClick={() => set(car.seatsTotal + 1)} className="h-7 w-7 rounded-full border border-ink/15 bg-white font-ui text-[12px] hover:bg-blueberry-200/30 disabled:opacity-30">+</button>
    </div>
  );
}

function ConfirmButton({ car, pending, run, fd }: Pick<CardProps, "car" | "pending" | "run" | "fd">) {
  const status = carStatus(car);
  if (car.stops.length === 0 || status === "confirmed") return null;
  const what = car.kind === "rideshare" ? "Uber" : "car";
  return (
    <Button
      type="button"
      variant={status === "changed" ? "primary" : "dark"}
      size="sm"
      disabled={pending}
      onClick={() => run(() => adminConfirmCar(fd({ carId: car.id })), status === "changed" ? `Change sent to everyone in the ${what}.` : `${what === "car" ? "Car" : "Uber"} confirmed — everyone has been told.`)}
    >
      {status === "changed" ? "Send changes" : `Confirm ${what}`}
    </Button>
  );
}

function CarCard({
  car,
  color,
  selected,
  onSelect,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStartRider,
  pending,
  run,
  fd,
  placing,
  setPlacing,
  placeMenu,
  fixPin,
}: CardProps) {
  const status = carStatus(car);
  const driver = car.driver!;

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= car.stops.length) return;
    const ids = car.stops.map((s) => s.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    run(() => adminReorderCar(fd({ carId: car.id, stopIds: ids.join(",") })));
  };

  return (
    <article
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "space-y-4 rounded-[20px] border bg-paper-2 p-4 transition-colors",
        dragOver ? "border-ink bg-paper-2" : selected ? "border-ink" : "border-ink/15"
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="flex min-w-0 items-start gap-3 text-left">
          <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: color }} />
          <div className="min-w-0">
            <p className="truncate font-heading text-2xl lowercase text-ink">{driver.name}</p>
            <p className={cn(body, "truncate text-sm text-ink/55")}>
              {driver.neighborhood ? `${driver.neighborhood} · ` : ""}
              {driver.address}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusChip status={status} />
          <span className={cn(label, "tabular-nums")}>
            {car.stops.length}/{car.seatsTotal} seats{car.stops.length > 0 ? ` · +${km(car.detourKm)}` : ""}
          </span>
          {fixPin(driver.offerId)}
        </div>
      </header>

      {car.stops.length === 0 ? (
        <p className={cn(body, "text-sm text-ink/55")}>Empty car. Drag a rider here or use Place.</p>
      ) : (
        <ol className="divide-y divide-dashed divide-ink/12">
          {car.stops.map((s, i) => (
            <li key={s.id} draggable onDragStart={(e) => onDragStartRider(e, s.rider.offerId)} className="cursor-grab space-y-1 py-2.5 active:cursor-grabbing">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white font-ui text-[10px]" style={{ borderColor: color, color }}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <PersonLine p={s.rider} />
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {s.confirmed ? <Chip tone="ok">Sent</Chip> : s.source === "matcher" ? <Chip tone="muted">Suggested</Chip> : <Chip tone="muted">Host</Chip>}
                    {s.addedKm > 0 ? <span className={label}>+{km(s.addedKm)}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label="Move up" disabled={pending || i === 0} onClick={() => reorder(i, i - 1)} className="px-1 font-ui text-[12px] text-ink/55 hover:text-ink disabled:opacity-30">↑</button>
                  <button type="button" aria-label="Move down" disabled={pending || i === car.stops.length - 1} onClick={() => reorder(i, i + 1)} className="px-1 font-ui text-[12px] text-ink/55 hover:text-ink disabled:opacity-30">↓</button>
                  <button type="button" disabled={pending} onClick={() => setPlacing(placing === s.rider.offerId ? null : s.rider.offerId)} className="ml-1 font-ui text-[10px] uppercase text-ink underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry">Move</button>
                  <span className="ml-1">{fixPin(s.rider.offerId)}</span>
                  <button type="button" disabled={pending} onClick={() => run(() => adminUnplaceRider(fd({ riderOfferId: s.rider.offerId })))} className="ml-1 font-ui text-[10px] uppercase text-ink/55 hover:text-ink">Out</button>
                </div>
              </div>
              {placing === s.rider.offerId ? <div className="pl-9">{placeMenu(s.rider.offerId, car.id)}</div> : null}
            </li>
          ))}
        </ol>
      )}

      <CarMessages car={car} />

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-ink/12 pt-3">
        <SeatStepper car={car} max={8} pending={pending} run={run} fd={fd} />
        <div className="flex flex-wrap items-center gap-2">
          {car.stops.length > 1 ? (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => adminOptimizeCar(fd({ carId: car.id })), "Reordered for the shortest route.")}>
              Shortest order
            </Button>
          ) : null}
          <ConfirmButton car={car} pending={pending} run={run} fd={fd} />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove ${driver.name} and their car?${car.stops.length ? ` ${car.stops.length} rider(s) will go back to unassigned.` : ""}`)) run(() => adminRemoveOffer(fd({ offerId: driver.offerId })));
            }}
            className="font-ui text-[10px] uppercase text-ink/55 hover:text-ink"
          >
            Remove driver
          </button>
        </div>
      </footer>
    </article>
  );
}

/** A shared Uber: riders walk to a campus meetup spot and one of them (or a host) orders the car. */
function UberCard({
  car,
  hubs,
  color,
  selected,
  onSelect,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStartRider,
  pending,
  run,
  fd,
  placing,
  setPlacing,
  placeMenu,
  fixPin,
}: CardProps & { hubs: HubView[] }) {
  const status = carStatus(car);
  const hub = car.hub;
  const [meetTime, setMeetTime] = useState(car.meetTime ?? "");
  useEffect(() => setMeetTime(car.meetTime ?? ""), [car.meetTime]); // e.g. reset after a hub switch
  const update = (fields: Record<string, string>, ok?: string) => run(() => adminUpdateRideshare(fd({ carId: car.id, ...fields })), ok);
  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-2.5 pt-1 pb-[3px] font-ui text-[10px] uppercase disabled:opacity-40",
      active ? "border-ink bg-ink text-paper" : "border-ink/15 bg-white text-ink/85 hover:bg-blueberry-200/30"
    );

  return (
    <article
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "space-y-4 rounded-[20px] border bg-paper-2 p-4 transition-colors",
        dragOver ? "border-ink bg-paper-2" : selected ? "border-ink" : "border-ink/15"
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="flex min-w-0 items-start gap-3 text-left">
          <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-[4px]" style={{ background: color }} />
          <div className="min-w-0">
            <p className="truncate font-heading text-2xl lowercase text-ink">{hub?.name ?? "no meetup spot"}</p>
            <p className={cn(body, "truncate text-sm text-ink/55")}>
              Uber{hub ? ` from ${hub.campus}` : ""} · {car.directKm > 0 ? `${km(car.directKm)} to the venue` : "venue has no location yet"}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusChip status={status} />
          <span className={cn(label, "tabular-nums")}>
            {car.stops.length}/{car.seatsTotal} seats
          </span>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <label className="block space-y-1.5">
          <span className={cn(label, "block")}>Meet at</span>
          <input
            type="time"
            value={meetTime}
            step={300}
            disabled={pending}
            onChange={(e) => setMeetTime(e.target.value)}
            onBlur={() => {
              if (meetTime && meetTime !== car.meetTime) update({ meetTime }, "Meet time saved.");
            }}
            className="h-9 rounded-full border border-ink/15 bg-white px-3 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lime"
          />
        </label>
        <div className="space-y-1.5">
          <span className={label}>Meetup spot</span>
          <div className="flex flex-wrap gap-1.5">
            {hubs.map((h) => (
              <button
                key={h.id}
                type="button"
                disabled={pending}
                aria-pressed={h.id === hub?.id}
                onClick={() => h.id !== hub?.id && update({ hubId: h.id }, `Moved to ${h.name}; meet time reset for the new drive.`)}
                className={pill(h.id === hub?.id)}
              >
                {h.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {car.stops.length === 0 ? (
        <p className={cn(body, "text-sm text-ink/55")}>Empty Uber. Drag riders here or use Place.</p>
      ) : (
        <>
          <ul className="divide-y divide-dashed divide-ink/12">
            {car.stops.map((s) => (
              <li key={s.id} draggable onDragStart={(e) => onDragStartRider(e, s.rider.offerId)} className="cursor-grab space-y-1 py-2.5 active:cursor-grabbing">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white font-ui text-[10px]" style={{ borderColor: color, color }}>
                    {s.rider.firstName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <PersonLine p={s.rider} />
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {s.confirmed ? <Chip tone="ok">Sent</Chip> : s.source === "matcher" ? <Chip tone="muted">Suggested</Chip> : <Chip tone="muted">Host</Chip>}
                      {car.bookerOfferId === s.rider.offerId ? <Chip tone="ink">Orders</Chip> : null}
                      {s.walkKm != null ? (
                        <span className={cn(label, s.walkKm > MAX_WALK_KM ? "text-red-700" : "")}>
                          {km(s.walkKm)} walk{s.walkKm > MAX_WALK_KM ? " — far" : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" disabled={pending} onClick={() => setPlacing(placing === s.rider.offerId ? null : s.rider.offerId)} className="font-ui text-[10px] uppercase text-ink underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry">Move</button>
                    <span className="ml-1">{fixPin(s.rider.offerId)}</span>
                    <button type="button" disabled={pending} onClick={() => run(() => adminUnplaceRider(fd({ riderOfferId: s.rider.offerId })))} className="ml-1 font-ui text-[10px] uppercase text-ink/55 hover:text-ink">Out</button>
                  </div>
                </div>
                {placing === s.rider.offerId ? <div className="pl-9">{placeMenu(s.rider.offerId, car.id)}</div> : null}
              </li>
            ))}
          </ul>

          <div className="space-y-1.5">
            <span className={label}>Who orders it</span>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" disabled={pending} aria-pressed={!car.bookerOfferId} onClick={() => update({ bookerOfferId: "host" })} className={pill(!car.bookerOfferId)}>
                A host
              </button>
              {car.stops.map((s) => (
                <button key={s.id} type="button" disabled={pending} aria-pressed={car.bookerOfferId === s.rider.offerId} onClick={() => update({ bookerOfferId: s.rider.offerId })} className={pill(car.bookerOfferId === s.rider.offerId)}>
                  {car.stops.filter((o) => o.rider.firstName === s.rider.firstName).length > 1 ? s.rider.name : s.rider.firstName}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <CarMessages car={car} />

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-ink/12 pt-3">
        <div className="flex items-center gap-3">
          <SeatStepper car={car} max={UBER_MAX_SEATS} pending={pending} run={run} fd={fd} />
          <span className={cn(label, "text-ink/40")}>{car.seatsTotal > 4 ? "needs an XL" : "UberX fits 4"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConfirmButton car={car} pending={pending} run={run} fd={fd} />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Cancel this Uber?${car.stops.length ? ` ${car.stops.length} rider(s) will go back to needing a ride${car.confirmedAt ? " and be told" : ""}.` : ""}`)) run(() => adminRemoveRideshare(fd({ carId: car.id })));
            }}
            className="font-ui text-[10px] uppercase text-ink/55 hover:text-ink"
          >
            Cancel Uber
          </button>
        </div>
      </footer>
    </article>
  );
}

function WriteIn({
  token,
  cars,
  colorOf,
  pending,
  run,
}: {
  token: string | null;
  cars: CarView[];
  colorOf: Map<string, string>;
  pending: boolean;
  run: (fn: () => Promise<Result>, okText?: string) => void;
}) {
  const [role, setRole] = useState<"rider" | "driver">("rider");
  const [carId, setCarId] = useState<string>("");
  const [seats, setSeats] = useState(3);
  const [formKey, setFormKey] = useState(0);

  return (
    <section className="space-y-4 border-t border-dashed border-ink/15 pt-8">
      <div>
        <h2 className={label}>Write someone in</h2>
        <p className={cn(body, "mt-1 text-sm text-ink/55")}>
          For people without an account. Add an email and they&apos;ll get the confirmation, and the entry becomes theirs if they sign up later.
        </p>
      </div>
      <form
        key={formKey}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          f.set("role", role);
          f.set("carId", role === "rider" ? carId : "");
          f.set("seatsTotal", String(seats));
          run(async () => {
            const r = await adminWriteIn(f);
            if (r.ok) {
              setFormKey((k) => k + 1);
              setCarId("");
            }
            return r;
          }, "Added to the board.");
        }}
      >
        <PillToggle
          aria-label="Role"
          value={role}
          onChange={setRole}
          size="sm"
          options={[
            { value: "rider", label: "Needs a ride" },
            { value: "driver", label: "Can drive" },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className={label}>Name</span>
            <input name="name" required placeholder="Jordan Chen" className={inputClass} />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Email (optional)</span>
            <input name="email" type="email" placeholder="they@usc.edu" className={inputClass} />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className={label}>Phone (optional)</span>
            <input name="phone" type="tel" placeholder="(310) 555-0101 — for texts about the ride" className={inputClass} />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className={label}>{role === "driver" ? "Starts from" : "Pickup address"}</span>
          <AddressInput token={token} placeholder="Street address, dorm, or landmark" />
          <span className={cn(body, "block text-xs text-ink/55")}>Leave blank to pin them at the venue and drag the pin into place.</span>
        </label>
        {role === "driver" ? (
          <div className="flex items-center gap-3">
            <span className={label}>Seats</span>
            <button type="button" aria-label="Fewer seats" onClick={() => setSeats((s) => Math.max(1, s - 1))} className="h-8 w-8 rounded-full border border-ink/15 bg-white font-ui hover:bg-blueberry-200/30">−</button>
            <span className="w-5 text-center font-body text-lg tabular-nums">{seats}</span>
            <button type="button" aria-label="More seats" onClick={() => setSeats((s) => Math.min(8, s + 1))} className="h-8 w-8 rounded-full border border-ink/15 bg-white font-ui hover:bg-blueberry-200/30">+</button>
          </div>
        ) : cars.length > 0 ? (
          <div className="space-y-1.5">
            <span className={label}>Put in a car or Uber (optional)</span>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setCarId("")} className={cn("rounded-full border px-2.5 pt-1 pb-[3px] font-ui text-[10px] uppercase", carId === "" ? "border-ink bg-ink text-paper" : "border-ink/15 bg-white text-ink/85 hover:bg-blueberry-200/30")}>
                Unassigned
              </button>
              {cars.map((c) => (
                <button key={c.id} type="button" disabled={c.stops.length >= c.seatsTotal} onClick={() => setCarId(c.id)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 pt-1 pb-[3px] font-ui text-[10px] uppercase disabled:opacity-40", carId === c.id ? "border-ink bg-ink text-paper" : "border-ink/15 bg-white text-ink/85 hover:bg-blueberry-200/30")}>
                  <span className="h-2 w-2 rounded-full" style={{ background: colorOf.get(c.id) }} />
                  {c.label} <span className="opacity-60">{c.stops.length}/{c.seatsTotal}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <label className="block space-y-1.5">
          <span className={label}>Notes (optional)</span>
          <input name="notes" placeholder="Leaving at 1:15, has a dog…" className={inputClass} />
        </label>
        <Button type="submit" variant="dark" size="sm" disabled={pending}>
          Add to board
        </Button>
      </form>
    </section>
  );
}
