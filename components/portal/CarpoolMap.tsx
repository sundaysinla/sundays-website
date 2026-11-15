"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GhostPin, MapCar, MapPoint } from "@/lib/carpool/map-types";

export type { GhostPin, MapCar, MapPoint };

export const CAR_COLORS = [
  "#1A1A17", // ink
  "#7A6F5A", // taupe, darkened
  "#5B6B3F", // olive
  "#3E5A78", // slate
  "#7A4E6E", // plum
  "#A4573A", // rust
  "#2F6F6A", // teal
  "#8A7A2C", // ochre
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

function straightLine(car: MapCar, venue: { lat: number; lng: number }): [number, number][] {
  return [
    [car.driver.lng, car.driver.lat],
    ...car.stops.map((s) => [s.lng, s.lat] as [number, number]),
    [venue.lng, venue.lat],
  ];
}

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

type Kind = "venue" | "driver" | "stop" | "unassigned" | "self" | "ghost";

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
      inner.style.background = "#BDFF00";
      inner.style.border = "2px solid #010101";
      inner.style.borderRadius = "3px";
      break;
    case "driver":
      inner.style.width = "28px";
      inner.style.height = "28px";
      inner.style.background = opts.color ?? "#010101";
      inner.style.color = "#FEFDFB";
      inner.style.border = "2px solid #FEFDFB";
      inner.style.boxShadow = "0 1px 4px rgba(1,1,1,0.25)";
      inner.textContent = opts.text ?? "D";
      break;
    case "stop":
      inner.style.width = "24px";
      inner.style.height = "24px";
      inner.style.background = "#FEFDFB";
      inner.style.color = opts.color ?? "#010101";
      inner.style.border = `2px solid ${opts.color ?? "#010101"}`;
      inner.style.boxShadow = "0 1px 4px rgba(1,1,1,0.2)";
      inner.textContent = opts.text ?? "";
      break;
    case "unassigned":
      inner.style.width = "22px";
      inner.style.height = "22px";
      inner.style.background = "#FEFDFB";
      inner.style.color = "#8a8478";
      inner.style.border = "2px dashed #C0B9A5";
      inner.textContent = opts.text ?? "?";
      break;
    case "self":
      inner.style.width = "26px";
      inner.style.height = "26px";
      inner.style.background = "#010101";
      inner.style.color = "#BDFF00";
      inner.style.border = "2px solid #BDFF00";
      inner.style.boxShadow = "0 1px 4px rgba(1,1,1,0.25)";
      inner.textContent = opts.text ?? "•";
      break;
    case "ghost":
      inner.style.width = "18px";
      inner.style.height = "18px";
      inner.style.background = "rgba(192,185,165,0.45)";
      inner.style.border = "1px solid rgba(138,132,120,0.6)";
      if (opts.label) {
        const tag = document.createElement("span");
        tag.textContent = opts.label;
        tag.style.position = "absolute";
        tag.style.top = "20px";
        tag.style.left = "50%";
        tag.style.transform = "translateX(-50%)";
        tag.style.whiteSpace = "nowrap";
        tag.style.fontFamily = "'Monument-Grotesk', system-ui, sans-serif";
        tag.style.fontSize = "9px";
        tag.style.letterSpacing = "0.06em";
        tag.style.textTransform = "uppercase";
        tag.style.color = "#8a8478";
        tag.style.background = "rgba(254,253,251,0.85)";
        tag.style.padding = "2px 4px";
        tag.style.borderRadius = "4px";
        root.style.position = "relative";
        root.appendChild(tag);
      }
      break;
  }

  if (opts.editable) {
    inner.style.outline = "3px solid #BDFF00";
    inner.style.outlineOffset = "2px";
  }
  return root;
}

export default function CarpoolMap({
  token,
  venue,
  cars,
  unassigned,
  self = null,
  ghosts = [],
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
        cars.map((c) => [c.driver.lat, c.driver.lng, ...c.stops.map((s) => [s.lat, s.lng])]),
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
        paint: { "line-color": "#FEFDFB", "line-width": 6, "line-opacity": ["get", "opacity"] },
      });
      map.addLayer({
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
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

    cars.forEach((car) => {
      const dim = !!selectedCarId && selectedCarId !== car.id;
      const d = markerEl("driver", {
        color: car.color,
        text: car.driver.name.slice(0, 1).toUpperCase(),
        dim,
        title: `${car.driver.name} (driver)`,
        editable: editablePinId === car.driver.offerId,
      });
      d.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        callbacks.current.onSelectCar?.(selectedCarId === car.id ? null : car.id);
      });
      add(d, car.driver.lng, car.driver.lat, car.driver.offerId);
      car.stops.forEach((s) => {
        const el = markerEl("stop", {
          color: car.color,
          text: String(s.order + 1),
          dim,
          title: `${s.name} · stop ${s.order + 1}`,
          editable: editablePinId === s.offerId,
        });
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          callbacks.current.onSelectCar?.(selectedCarId === car.id ? null : car.id);
        });
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
  }, [ready, venue, cars, unassigned, self, ghosts, selectedCarId, editablePinId, onPinMove]);

  // Routes: straight lines immediately, road geometry when Directions answers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !venue) return;
    const source = map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const drawn = cars.filter((c) => c.stops.length > 0 || selectedCarId === c.id);
    const build = (lines: Map<string, [number, number][]>) => ({
      type: "FeatureCollection" as const,
      features: drawn.map((c) => ({
        type: "Feature" as const,
        properties: {
          color: c.color,
          opacity: selectedCarId && selectedCarId !== c.id ? 0.18 : 0.9,
          straight: !lines.has(c.id),
        },
        geometry: { type: "LineString" as const, coordinates: lines.get(c.id) ?? straightLine(c, venue) },
      })),
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
      pts.push([c.driver.lng, c.driver.lat]);
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
