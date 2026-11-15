"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GhostPin, HubPin, MapCar, MapPoint } from "@/lib/carpool/map-types";

export type { GhostPin, HubPin, MapCar, MapPoint };

export const CAR_COLORS = [
  "#3600CF", // blueberry
  "#E24BB4", // cursor pink
  "#1FA463", // cursor green
  "#F07C1F", // orange
  "#010101", // ink
  "#7B61FF", // cursor purple
  "#2F6F6A", // teal
  "#B8860B", // ochre
];

export function carColor(index: number) {
  return CAR_COLORS[index % CAR_COLORS.length];
}

type Props = {
  token: string;
  venue: { lat: number; lng: number; label: string } | null;
  cars: MapCar[];
  unassigned: MapPoint[];
  /** The viewer's own pin (member map). */
  self?: MapPoint | null;
  /** Approximate, unlabeled or first-name-only dots (member map). */
  ghosts?: GhostPin[];
  /** Uber meetup spots to show even when no group uses them (host map). */
  hubs?: HubPin[];
  selectedCarId?: string | null;
  onSelectCar?: (id: string | null) => void;
  /** The one pin a host may drag right now. Nothing is draggable otherwise. */
  editablePinId?: string | null;
  /** Called after a drag ends. Return false to snap the pin back. */
  onPinMove?: (offerId: string, lat: number, lng: number) => Promise<boolean> | boolean;
  className?: string;
};

const ROUTE_SOURCE = "carpool-routes";
const ROUTE_LAYER = "carpool-routes-line";
const ROUTE_CASING = "carpool-routes-casing";

/** The car's drive: driver → stops → venue, or for an Uber group, hub → venue. */
function straightLine(car: MapCar, venue: { lat: number; lng: number }): [number, number][] {
  if (car.hub) return [[car.hub.lng, car.hub.lat], [venue.lng, venue.lat]];
  return [
    ...(car.driver ? [[car.driver.lng, car.driver.lat] as [number, number]] : []),
    ...car.stops.map((s) => [s.lng, s.lat] as [number, number]),
    [venue.lng, venue.lat],
  ];
}

const hubKey = (h: HubPin) => `${h.lat.toFixed(5)},${h.lng.toFixed(5)}`;

const directionsCache = new Map<string, [number, number][]>();

async function fetchDrivingLine(
  coords: [number, number][],
  token: string,
  signal: AbortSignal
): Promise<[number, number][] | null> {
  const key = coords.map((c) => c.join(",")).join(";");
  const cached = directionsCache.get(key);
  if (cached) return cached;
  if (coords.length < 2 || coords.length > 25) return null;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${encodeURIComponent(key)}`);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("access_token", token);
  try {
    const res = await fetch(url.toString(), { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: { geometry: { coordinates: [number, number][] } }[] };
    const line = data.routes?.[0]?.geometry.coordinates ?? null;
    if (line) directionsCache.set(key, line);
    return line;
  } catch {
    return null;
  }
}

type Kind = "venue" | "driver" | "stop" | "unassigned" | "self" | "ghost" | "hub";

/**
 * Mapbox owns the root element's transform (that's how it positions markers),
 * so every visual style lives on an inner element.
 */
function markerEl(
  kind: Kind,
  opts: { color?: string; text?: string; dim?: boolean; title?: string; editable?: boolean; label?: string | null }
) {
  const root = document.createElement("div");
  const inner = document.createElement("div");
  root.appendChild(inner);
  root.title = opts.title ?? "";
  root.style.cursor = kind === "ghost" || kind === "venue" ? "default" : opts.editable ? "grab" : "pointer";
  if (kind === "ghost") root.style.pointerEvents = "none";

  inner.style.fontFamily = "'Monument-Grotesk', system-ui, sans-serif";
  inner.style.fontSize = "10px";
  inner.style.lineHeight = "1";
  inner.style.display = "flex";
  inner.style.alignItems = "center";
  inner.style.justifyContent = "center";
  inner.style.boxSizing = "border-box";
  inner.style.transition = "opacity 200ms ease-out";
  inner.style.opacity = opts.dim ? "0.3" : "1";
  inner.style.borderRadius = "999px";

  switch (kind) {
    case "venue":
      inner.style.width = "18px";
      inner.style.height = "18px";
      inner.style.transform = "rotate(45deg)";
      inner.style.background = "#CBFF36";
      inner.style.border = "2px solid #010101";
      inner.style.borderRadius = "3px";
      break;
    case "driver":
      inner.style.width = "28px";
      inner.style.height = "28px";
      inner.style.background = opts.color ?? "#010101";
      inner.style.color = "#FCFAF7";
      inner.style.border = "2px solid #FCFAF7";
      inner.style.boxShadow = "0 1px 4px rgba(1,1,1,0.25)";
      inner.textContent = opts.text ?? "D";
      break;
    case "stop":
      inner.style.width = "24px";
      inner.style.height = "24px";
      inner.style.background = "#FCFAF7";
      inner.style.color = opts.color ?? "#010101";
      inner.style.border = `2px solid ${opts.color ?? "#010101"}`;
      inner.style.boxShadow = "0 1px 4px rgba(1,1,1,0.2)";
      inner.textContent = opts.text ?? "";
      break;
    case "unassigned":
      inner.style.width = "22px";
      inner.style.height = "22px";
      inner.style.background = "#FCFAF7";
      inner.style.color = "#010101";
      inner.style.border = "2px dashed rgba(1,1,1,0.45)";
      inner.textContent = opts.text ?? "?";
      break;
    case "self":
      cursorLabel(root, inner, { fill: "#010101", text: "#CBFF36", label: "me" });
      break;
    case "hub":
      // A square "U" for the Uber meetup spot, with its name beside it.
      inner.style.display = "block";
      inner.style.position = "relative";
      inner.style.width = "24px";
      inner.style.height = "24px";
      inner.style.borderRadius = "6px";
      inner.style.background = "#010101";
      inner.style.border = "2px solid #FCFAF7";
      inner.style.boxShadow = "0 1px 4px rgba(1,1,1,0.25)";
      inner.innerHTML = `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;color:#CBFF36;font-size:11px">U</span>`;
      if (opts.label) {
        const tag = document.createElement("span");
        tag.textContent = opts.label;
        Object.assign(tag.style, {
          position: "absolute",
          left: "26px",
          top: "4px",
          whiteSpace: "nowrap",
          fontSize: "10px",
          lineHeight: "1",
          padding: "3px 5px 2px",
          borderRadius: "4px",
          background: "rgba(252,250,247,0.92)",
          color: "#010101",
        });
        inner.appendChild(tag);
      }
      break;
    case "ghost":
      if (opts.label) {
        cursorLabel(root, inner, { fill: opts.color ?? "#3600CF", text: "#FCFAF7", label: opts.label });
      } else {
        inner.style.width = "16px";
        inner.style.height = "16px";
        inner.style.background = "rgba(195,179,241,0.7)";
        inner.style.border = "1px solid rgba(54,0,207,0.35)";
      }
      break;
  }

  if (opts.editable) {
    inner.style.outline = "3px solid #CBFF36";
    inner.style.outlineOffset = "2px";
  }
  return root;
}


/** A pointer with a rounded label beside it — the guide's "Me" / "You ;)" cursor marks. */
function cursorLabel(root: HTMLDivElement, inner: HTMLDivElement, o: { fill: string; text: string; label: string }) {
  inner.style.display = "block";
  inner.style.position = "relative";
  inner.style.width = "16px";
  inner.style.height = "16px";
  inner.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" style="display:block"><path d="M2 1.5 L14 7.5 L8.5 9 L6.5 14.5 Z" fill="${o.fill}" stroke="#FCFAF7" stroke-width="1"/></svg>`;
  const tag = document.createElement("span");
  tag.textContent = o.label;
  tag.style.position = "absolute";
  tag.style.left = "14px";
  tag.style.top = "12px";
  tag.style.whiteSpace = "nowrap";
  tag.style.fontFamily = "'PP Neue Montreal', 'Monument-Grotesk', system-ui, sans-serif";
  tag.style.fontSize = "10px";
  tag.style.lineHeight = "1";
  tag.style.padding = "4px 6px 3px";
  tag.style.borderRadius = "4px";
  tag.style.background = o.fill;
  tag.style.color = o.text;
  tag.style.boxShadow = "0 1px 3px rgba(1,1,1,0.2)";
  inner.appendChild(tag);
}

export default function CarpoolMap({
  token,
  venue,
  cars,
  unassigned,
  self = null,
  ghosts = [],
  hubs = [],
  selectedCarId = null,
  onSelectCar,
  editablePinId = null,
  onPinMove,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onSelectCar, onPinMove });
  callbacks.current = { onSelectCar, onPinMove };

  // Stable fingerprint of the points so we only refit when geography changes.
  const fitKey = useMemo(
    () =>
      JSON.stringify([
        venue ? [venue.lat, venue.lng] : null,
        cars.map((c) => [c.driver?.lat, c.driver?.lng, c.hub?.lat, c.hub?.lng, ...c.stops.map((s) => [s.lat, s.lng])]),
        unassigned.map((u) => [u.lat, u.lng]),
        self ? [self.lat, self.lng] : null,
        ghosts.map((g) => [g.lat, g.lng]),
      ]),
    [venue, cars, unassigned, self, ghosts]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-118.36, 34.04],
      zoom: 10.5,
      attributionControl: false,
      cooperativeGestures: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource(ROUTE_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: ROUTE_CASING,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#FCFAF7", "line-width": ["+", ["get", "width"], 3], "line-opacity": ["get", "opacity"] },
      });
      map.addLayer({
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["get", "width"],
          "line-opacity": ["get", "opacity"],
          "line-dasharray": ["case", ["get", "straight"], ["literal", [1.5, 1.5]], ["literal", [1, 0]]],
        },
      });
      map.on("click", (e) => {
        if (!e.originalEvent.defaultPrevented) callbacks.current.onSelectCar?.(null);
      });
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const add = (el: HTMLElement, lng: number, lat: number, offerId?: string) => {
      const editable = !!offerId && editablePinId === offerId && !!onPinMove;
      // clickTolerance: a jittery click is a click, not a move.
      const marker = new mapboxgl.Marker({ element: el, draggable: editable, clickTolerance: 6 });
      marker.setLngLat([lng, lat]).addTo(map);
      if (editable && offerId) {
        const origin: [number, number] = [lng, lat];
        marker.on("dragend", async () => {
          const p = marker.getLngLat();
          const ok = await callbacks.current.onPinMove?.(offerId, p.lat, p.lng);
          if (ok === false) marker.setLngLat(origin);
        });
      }
      markersRef.current.push(marker);
      return marker;
    };

    if (venue) add(markerEl("venue", { title: venue.label }), venue.lng, venue.lat);

    for (const g of ghosts) {
      add(markerEl("ghost", { label: g.label, title: g.label ?? "someone on the board" }), g.lng, g.lat);
    }

    // One marker per meetup spot, however many groups leave from it.
    const inUse = new Set(cars.filter((c) => c.hub).map((c) => hubKey(c.hub!)));
    const allHubs = new Map<string, HubPin>();
    for (const h of [...hubs, ...cars.flatMap((c) => (c.hub ? [c.hub] : []))]) allHubs.set(hubKey(h), h);
    for (const [key, h] of allHubs) {
      add(markerEl("hub", { label: h.label, title: `${h.label} · Uber meetup spot`, dim: !inUse.has(key) }), h.lng, h.lat);
    }

    cars.forEach((car) => {
      const dim = !!selectedCarId && selectedCarId !== car.id;
      const select = (el: HTMLElement) =>
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          callbacks.current.onSelectCar?.(selectedCarId === car.id ? null : car.id);
        });
      if (car.driver) {
        const d = markerEl("driver", {
          color: car.color,
          text: car.driver.name.slice(0, 1).toUpperCase(),
          dim,
          title: `${car.driver.name} (driver)`,
          editable: editablePinId === car.driver.offerId,
        });
        select(d);
        add(d, car.driver.lng, car.driver.lat, car.driver.offerId);
      }
      car.stops.forEach((s) => {
        const el = markerEl("stop", {
          color: car.color,
          // Uber riders all meet at one spot, so show who rather than a stop number.
          text: car.hub ? s.name.slice(0, 1).toUpperCase() : String(s.order + 1),
          dim,
          title: car.hub ? `${s.name} · walks to ${car.hub.label}` : `${s.name} · stop ${s.order + 1}`,
          editable: editablePinId === s.offerId,
        });
        select(el);
        add(el, s.lng, s.lat, s.offerId);
      });
    });

    unassigned.forEach((u) => {
      const el = markerEl("unassigned", {
        text: u.name.slice(0, 1).toUpperCase(),
        dim: !!selectedCarId,
        title: `${u.name} · needs a ride`,
        editable: editablePinId === u.offerId,
      });
      add(el, u.lng, u.lat, u.offerId);
    });

    if (self) add(markerEl("self", { text: self.name.slice(0, 1).toUpperCase(), title: "You" }), self.lng, self.lat);
  }, [ready, venue, cars, unassigned, self, ghosts, hubs, selectedCarId, editablePinId, onPinMove]);

  // Routes: straight lines immediately, road geometry when Directions answers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !venue) return;
    const source = map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const drawn = cars.filter((c) => c.stops.length > 0 || c.hub || selectedCarId === c.id);
    const feature = (coordinates: [number, number][], p: { color: string; opacity: number; straight: boolean; width: number }) => ({
      type: "Feature" as const,
      properties: p,
      geometry: { type: "LineString" as const, coordinates },
    });
    const build = (lines: Map<string, [number, number][]>) => ({
      type: "FeatureCollection" as const,
      features: drawn.flatMap((c) => {
        const dim = !!selectedCarId && selectedCarId !== c.id;
        const drive = feature(lines.get(c.id) ?? straightLine(c, venue), {
          color: c.color,
          opacity: dim ? 0.18 : 0.9,
          straight: !lines.has(c.id),
          width: 3,
        });
        // Uber riders walk to the hub: a thin dotted line from each of them.
        const walks = c.hub
          ? c.stops.map((s) =>
              feature([[s.lng, s.lat], [c.hub!.lng, c.hub!.lat]], { color: c.color, opacity: dim ? 0.12 : 0.55, straight: true, width: 1.5 })
            )
          : [];
        return [drive, ...walks];
      }),
    });

    const lines = new Map<string, [number, number][]>();
    source.setData(build(lines));

    const ctrl = new AbortController();
    (async () => {
      await Promise.all(
        drawn.map(async (c) => {
          const line = await fetchDrivingLine(straightLine(c, venue), token, ctrl.signal);
          if (line && !ctrl.signal.aborted) {
            lines.set(c.id, line);
            source.setData(build(lines));
          }
        })
      );
    })();
    return () => ctrl.abort();
  }, [ready, venue, cars, selectedCarId, token]);

  // Fit
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const pts: [number, number][] = [];
    if (venue) pts.push([venue.lng, venue.lat]);
    for (const c of cars) {
      if (c.driver) pts.push([c.driver.lng, c.driver.lat]);
      if (c.hub) pts.push([c.hub.lng, c.hub.lat]);
      for (const s of c.stops) pts.push([s.lng, s.lat]);
    }
    for (const u of unassigned) pts.push([u.lng, u.lat]);
    if (self) pts.push([self.lng, self.lat]);
    for (const g of ghosts) pts.push([g.lng, g.lat]);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.easeTo({ center: pts[0], zoom: 13 });
      return;
    }
    const b = pts.reduce((acc, p) => acc.extend(p), new mapboxgl.LngLatBounds(pts[0], pts[0]));
    map.fitBounds(b, { padding: 64, maxZoom: 14, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  return <div ref={containerRef} className={className} />;
}
