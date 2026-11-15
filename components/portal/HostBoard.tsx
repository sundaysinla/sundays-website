"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import PillToggle from "@/components/portal/PillToggle";
import AddressInput, { inputClass } from "@/components/portal/AddressInput";
import CarpoolMap, { carColor, type MapCar } from "@/components/portal/CarpoolMap";
import CarThread from "@/components/portal/CarThread";
import ImportSheet from "@/components/portal/ImportSheet";
import { formatPhone } from "@/lib/phone";
import type { CarView, HostBoard as Board, PersonView } from "@/lib/carpool/board";
import {
  adminConfirmCar,
  adminMovePin,
  adminOptimizeCar,
  adminPlaceRider,
  adminPostCarMessage,
  adminRemoveOffer,
  adminReorderCar,
  adminSetSeats,
  adminSuggest,
  adminSyncLuma,
  adminUnplaceRider,
  adminWriteIn,
} from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

const label = "font-['Monument-Grotesk'] text-[10px] uppercase tracking-wide text-[#C0B9A5]";
const body = "font-['Office-Times-Round'] text-[#2A2A24]";

function km(n: number) {
  return `${n.toFixed(1)} km`;
}

function Chip({ tone, children }: { tone: "ok" | "warn" | "muted" | "ink"; children: React.ReactNode }) {
  const tones = {
    ok: "bg-[#BDFF00]/40 text-[#2A2A24]",
    warn: "bg-[#EEEBE3] text-[#8a8478]",
    muted: "bg-transparent text-[#C0B9A5] border border-dashed border-[#C0B9A5]/60",
    ink: "bg-black text-[#EEEBE3]",
  };
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 pt-[3px] pb-[2px] font-['Monument-Grotesk'] text-[9px] uppercase tracking-wide", tones[tone])}>
      {children}
    </span>
  );
}

function PersonLine({ p, showAddress = true }: { p: PersonView; showAddress?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cn(body, "truncate text-base text-[#010101]")}>
        {p.name}
        {p.guest ? <span className="ml-2 font-['Monument-Grotesk'] text-[9px] uppercase text-[#C0B9A5]">write-in</span> : null}
      </p>
      <p className={cn(body, "truncate text-sm text-[#8a8478]")}>
        {p.neighborhood ? `${p.neighborhood}` : ""}
        {showAddress ? `${p.neighborhood ? " · " : ""}${p.address}` : ""}
      </p>
      {p.phone ? (
        <a href={`tel:${p.phone}`} className={cn(body, "block text-xs text-[#8a8478] hover:text-[#010101]")}>
          {formatPhone(p.phone)}
        </a>
      ) : null}
      {p.notes ? <p className={cn(body, "text-sm italic text-[#8a8478]")}>“{p.notes}”</p> : null}
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
      m.set(c.driver.offerId, c.driver.firstName);
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
        "font-['Monument-Grotesk'] text-[10px] uppercase underline-offset-4",
        editPin === offerId ? "text-[#010101] underline decoration-[#BDFF00] decoration-2" : "text-[#C0B9A5] hover:text-[#8a8478]"
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
    driver: { offerId: c.driver.offerId, lat: c.driver.lat, lng: c.driver.lng, name: c.driver.name },
    stops: c.stops.map((s) => ({ offerId: s.rider.offerId, lat: s.rider.lat, lng: s.rider.lng, name: s.rider.name, order: s.order, confirmed: s.confirmed })),
  }));

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
              className="inline-flex items-center gap-1.5 rounded-full border border-[#C0B9A5]/60 bg-white px-2.5 pt-1 pb-[3px] font-['Monument-Grotesk'] text-[10px] uppercase text-[#2A2A24] hover:bg-[#EEEBE3] disabled:opacity-40"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: colorOf.get(c.id) }} />
              {c.driver.firstName}
              <span className="text-[#C0B9A5]">{c.stops.length}/{c.seatsTotal}</span>
            </button>
          );
        })}
      {board.cars.length <= (excludeCarId ? 1 : 0) ? <span className={cn(body, "text-sm text-[#8a8478]")}>No other cars yet.</span> : null}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* summary + primary actions */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-dashed border-[#C0B9A5]/50 pt-6">
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          {[
            ["Cars", board.counts.drivers],
            ["Riders", board.counts.riders],
            ["Seated", `${board.counts.seated} / ${board.counts.seats}`],
            ["Unassigned", board.unassigned.length],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className={label}>{k}</dt>
              <dd className="font-['Office-Times-Sharp-Regular'] text-2xl text-[#010101] tabular-nums">{v}</dd>
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
                if (r.ok) setNotice({ tone: "ok", text: `Suggested ${r.placed ?? 0} placement${r.placed === 1 ? "" : "s"}${r.unplaced ? `, ${r.unplaced} still unassigned` : ""}.` });
                return r;
              })
            }
          >
            Suggest placements
          </Button>
        </div>
      </div>

      {notice ? (
        <p className={cn(body, "text-sm", notice.tone === "error" ? "text-red-700" : "text-[#3A372F]")} role="status">
          {notice.text}
        </p>
      ) : null}

      <div className="grid gap-y-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-16">
        {/* map */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          {editPin ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#BDFF00]/40 px-4 py-2.5">
              <p className={cn(body, "text-sm text-[#010101]")}>
                Drag <strong>{nameOf.get(editPin) ?? "this"}</strong>&apos;s pin to the right spot. You&apos;ll be asked to confirm before it saves.
              </p>
              <button type="button" onClick={() => setEditPin(null)} className="font-['Monument-Grotesk'] text-[10px] uppercase text-[#010101] underline underline-offset-4">
                Cancel
              </button>
            </div>
          ) : null}
          {token ? (
            <CarpoolMap
              token={token}
              venue={venue}
              cars={mapCars}
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
              className="h-[52vh] w-full overflow-hidden rounded-[24px] border border-[#C0B9A5]/50 bg-[#EEEBE3] lg:h-[calc(100vh-8rem)]"
            />
          ) : (
            <div className="flex h-[40vh] items-center justify-center rounded-[24px] border border-dashed border-[#C0B9A5] bg-[#FCFAF7] p-8 text-center">
              <p className={cn(body, "max-w-sm text-sm text-[#8a8478]")}>
                Set a public <code>pk.</code> Mapbox token as <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> (or <code>MAPBOX_TOKEN</code>) to see the map.
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-2.5 w-2.5 rotate-45 border border-black bg-[#BDFF00]" /> venue</span>
            <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-3 w-3 rounded-full bg-black" /> driver</span>
            <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-3 w-3 rounded-full border-2 border-black bg-white" /> stop</span>
            <span className={cn(label, "flex items-center gap-1.5")}><span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-[#C0B9A5] bg-white" /> unassigned</span>
            <span className={cn(label, "text-[#8a8478]")}>use “fix pin” next to a name to move their pin</span>
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
            className={cn("space-y-3 rounded-[20px] border border-dashed p-4 transition-colors", dragOver === "unassigned" ? "border-black bg-[#EEEBE3]" : "border-[#C0B9A5]/50")}
          >
            <div className="flex items-baseline justify-between">
              <h2 className={label}>Needs a ride · {board.unassigned.length}</h2>
              <span className={cn(label, "text-[#8a8478]")}>drop here to unassign</span>
            </div>
            {board.unassigned.length === 0 ? (
              <p className={cn(body, "text-sm text-[#8a8478]")}>Everyone who asked for a ride is in a car.</p>
            ) : (
              <ul className="divide-y divide-dashed divide-[#C0B9A5]/40">
                {board.unassigned.map((r) => (
                  <li key={r.offerId} draggable onDragStart={(e) => onDragStart(e, r.offerId)} className="cursor-grab space-y-1 py-3 active:cursor-grabbing">
                    <div className="flex items-start justify-between gap-3">
                      <PersonLine p={r} />
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" disabled={pending || board.cars.length === 0} onClick={() => setPlacing(placing === r.offerId ? null : r.offerId)} className="font-['Monument-Grotesk'] text-[10px] uppercase text-[#010101] underline decoration-[#C0B9A5] underline-offset-4 hover:decoration-black disabled:opacity-40">
                          Place
                        </button>
                        {fixPin(r.offerId)}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (confirm(`Remove ${r.name} from this week's board?`)) run(() => adminRemoveOffer(fd({ offerId: r.offerId })));
                          }}
                          className="font-['Monument-Grotesk'] text-[10px] uppercase text-[#C0B9A5] hover:text-[#8a8478]"
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
            <h2 className={label}>Cars · {board.cars.length}</h2>
            {board.cars.length === 0 ? (
              <p className={cn(body, "text-sm text-[#8a8478]")}>No drivers yet. Write one in below, or wait for members to offer.</p>
            ) : (
              board.cars.map((car) => (
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

          <WriteIn token={token} cars={board.cars} colorOf={colorOf} pending={pending} run={run} />
          <ImportSheet />
        </div>
      </div>
    </div>
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
}: {
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
}) {
  const status = car.confirmedAt ? (car.changedAt || car.pendingStops > 0 ? "changed" : "confirmed") : "draft";
  const full = car.stops.length >= car.seatsTotal;
  const [showThread, setShowThread] = useState(false);

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
        "space-y-4 rounded-[20px] border bg-[#FCFAF7] p-4 transition-colors",
        dragOver ? "border-black bg-[#EEEBE3]" : selected ? "border-black" : "border-[#C0B9A5]/50"
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="flex min-w-0 items-start gap-3 text-left">
          <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: color }} />
          <div className="min-w-0">
            <p className="truncate font-['Office-Times-Sharp-Regular'] text-xl lowercase text-[#010101]">{car.driver.name}</p>
            <p className={cn(body, "truncate text-sm text-[#8a8478]")}>
              {car.driver.neighborhood ? `${car.driver.neighborhood} · ` : ""}
              {car.driver.address}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {status === "confirmed" ? <Chip tone="ok">Confirmed</Chip> : status === "changed" ? <Chip tone="warn">Changed</Chip> : <Chip tone="muted">Not sent</Chip>}
          <span className={cn(label, "tabular-nums")}>
            {car.stops.length}/{car.seatsTotal} seats{car.stops.length > 0 ? ` · +${km(car.detourKm)}` : ""}
          </span>
          {fixPin(car.driver.offerId)}
        </div>
      </header>

      {car.stops.length === 0 ? (
        <p className={cn(body, "text-sm text-[#8a8478]")}>Empty car. Drag a rider here or use Place.</p>
      ) : (
        <ol className="divide-y divide-dashed divide-[#C0B9A5]/40">
          {car.stops.map((s, i) => (
            <li key={s.id} draggable onDragStart={(e) => onDragStartRider(e, s.rider.offerId)} className="cursor-grab space-y-1 py-2.5 active:cursor-grabbing">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white font-['Monument-Grotesk'] text-[10px]" style={{ borderColor: color, color }}>
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
                  <button type="button" aria-label="Move up" disabled={pending || i === 0} onClick={() => reorder(i, i - 1)} className="px-1 font-['Monument-Grotesk'] text-[12px] text-[#8a8478] hover:text-black disabled:opacity-30">↑</button>
                  <button type="button" aria-label="Move down" disabled={pending || i === car.stops.length - 1} onClick={() => reorder(i, i + 1)} className="px-1 font-['Monument-Grotesk'] text-[12px] text-[#8a8478] hover:text-black disabled:opacity-30">↓</button>
                  <button type="button" disabled={pending} onClick={() => setPlacing(placing === s.rider.offerId ? null : s.rider.offerId)} className="ml-1 font-['Monument-Grotesk'] text-[10px] uppercase text-[#010101] underline decoration-[#C0B9A5] underline-offset-4 hover:decoration-black">Move</button>
                  <span className="ml-1">{fixPin(s.rider.offerId)}</span>
                  <button type="button" disabled={pending} onClick={() => run(() => adminUnplaceRider(fd({ riderOfferId: s.rider.offerId })))} className="ml-1 font-['Monument-Grotesk'] text-[10px] uppercase text-[#C0B9A5] hover:text-[#8a8478]">Out</button>
                </div>
              </div>
              {placing === s.rider.offerId ? <div className="pl-9">{placeMenu(s.rider.offerId, car.id)}</div> : null}
            </li>
          ))}
        </ol>
      )}

      {car.stops.length > 0 ? (
        <div className="space-y-3 border-t border-dashed border-[#C0B9A5]/40 pt-3">
          <button
            type="button"
            onClick={() => setShowThread((v) => !v)}
            className="flex w-full items-center justify-between font-['Monument-Grotesk'] text-[10px] uppercase tracking-wide text-[#010101]"
            aria-expanded={showThread}
          >
            <span>
              Messages · {car.messages.length}
              {car.messages.length > 0 ? (
                <span className="ml-2 normal-case tracking-normal text-[#8a8478]">
                  last from {car.messages[car.messages.length - 1].authorFirstName}
                </span>
              ) : null}
            </span>
            <span className="text-[#C0B9A5]">{showThread ? "hide" : "open"}</span>
          </button>
          {showThread ? (
            <CarThread
              carId={car.id}
              messages={car.messages}
              post={adminPostCarMessage}
              compact
              placeholder="Post as a host — everyone in the car is told."
              emptyText="No messages in this car yet."
            />
          ) : null}
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[#C0B9A5]/40 pt-3">
        <div className="flex items-center gap-2">
          <span className={label}>Seats</span>
          <button type="button" aria-label="Fewer seats" disabled={pending || car.seatsTotal <= 1} onClick={() => run(() => adminSetSeats(fd({ carId: car.id, seatsTotal: car.seatsTotal - 1 })))} className="h-7 w-7 rounded-full border border-[#C0B9A5]/60 bg-white font-['Monument-Grotesk'] text-[12px] hover:bg-[#EEEBE3] disabled:opacity-30">−</button>
          <span className="w-4 text-center font-['Office-Times-Round'] text-base tabular-nums">{car.seatsTotal}</span>
          <button type="button" aria-label="More seats" disabled={pending || car.seatsTotal >= 8} onClick={() => run(() => adminSetSeats(fd({ carId: car.id, seatsTotal: car.seatsTotal + 1 })))} className="h-7 w-7 rounded-full border border-[#C0B9A5]/60 bg-white font-['Monument-Grotesk'] text-[12px] hover:bg-[#EEEBE3] disabled:opacity-30">+</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {car.stops.length > 1 ? (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => adminOptimizeCar(fd({ carId: car.id })), "Reordered for the shortest route.")}>
              Shortest order
            </Button>
          ) : null}
          {car.stops.length > 0 && status !== "confirmed" ? (
            <Button type="button" variant={status === "changed" ? "primary" : "dark"} size="sm" disabled={pending} onClick={() => run(() => adminConfirmCar(fd({ carId: car.id })), status === "changed" ? "Change sent to everyone in the car." : "Car confirmed — everyone has been told.")}>
              {status === "changed" ? "Send changes" : "Confirm car"}
            </Button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove ${car.driver.name} and their car?${car.stops.length ? ` ${car.stops.length} rider(s) will go back to unassigned.` : ""}`)) run(() => adminRemoveOffer(fd({ offerId: car.driver.offerId })));
            }}
            className="font-['Monument-Grotesk'] text-[10px] uppercase text-[#C0B9A5] hover:text-[#8a8478]"
          >
            Remove driver
          </button>
        </div>
      </footer>
      {full && status !== "confirmed" && car.stops.length > 0 ? null : null}
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
    <section className="space-y-4 border-t border-dashed border-[#C0B9A5]/50 pt-8">
      <div>
        <h2 className={label}>Write someone in</h2>
        <p className={cn(body, "mt-1 text-sm text-[#8a8478]")}>
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
          <span className={cn(body, "block text-xs text-[#8a8478]")}>Leave blank to pin them at the venue and drag the pin into place.</span>
        </label>
        {role === "driver" ? (
          <div className="flex items-center gap-3">
            <span className={label}>Seats</span>
            <button type="button" aria-label="Fewer seats" onClick={() => setSeats((s) => Math.max(1, s - 1))} className="h-8 w-8 rounded-full border border-[#C0B9A5]/60 bg-white font-['Monument-Grotesk'] hover:bg-[#EEEBE3]">−</button>
            <span className="w-5 text-center font-['Office-Times-Round'] text-lg tabular-nums">{seats}</span>
            <button type="button" aria-label="More seats" onClick={() => setSeats((s) => Math.min(8, s + 1))} className="h-8 w-8 rounded-full border border-[#C0B9A5]/60 bg-white font-['Monument-Grotesk'] hover:bg-[#EEEBE3]">+</button>
          </div>
        ) : cars.length > 0 ? (
          <div className="space-y-1.5">
            <span className={label}>Put in a car (optional)</span>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setCarId("")} className={cn("rounded-full border px-2.5 pt-1 pb-[3px] font-['Monument-Grotesk'] text-[10px] uppercase", carId === "" ? "border-black bg-black text-[#EEEBE3]" : "border-[#C0B9A5]/60 bg-white text-[#2A2A24] hover:bg-[#EEEBE3]")}>
                Unassigned
              </button>
              {cars.map((c) => (
                <button key={c.id} type="button" disabled={c.stops.length >= c.seatsTotal} onClick={() => setCarId(c.id)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 pt-1 pb-[3px] font-['Monument-Grotesk'] text-[10px] uppercase disabled:opacity-40", carId === c.id ? "border-black bg-black text-[#EEEBE3]" : "border-[#C0B9A5]/60 bg-white text-[#2A2A24] hover:bg-[#EEEBE3]")}>
                  <span className="h-2 w-2 rounded-full" style={{ background: colorOf.get(c.id) }} />
                  {c.driver.firstName} <span className="opacity-60">{c.stops.length}/{c.seatsTotal}</span>
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
