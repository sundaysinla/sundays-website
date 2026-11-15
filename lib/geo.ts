export type GeoResult = {
  lat: number;
  lng: number;
  placeName: string;
  neighborhood: string | null;
};

/** Center of the USC / UCLA corridor, used to bias geocoding. */
export const LA_PROXIMITY = "-118.36,34.04";

export async function geocodeAddress(query: string): Promise<GeoResult> {
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    throw new Error("MAPBOX_TOKEN is not configured");
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");
  url.searchParams.set("country", "US");
  url.searchParams.set("proximity", LA_PROXIMITY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Geocoding failed (${res.status})`);
  }

  const data = (await res.json()) as {
    features?: {
      center: [number, number];
      place_name: string;
      context?: { id: string; text: string }[];
      text?: string;
    }[];
  };

  const feature = data.features?.[0];
  if (!feature) {
    throw new Error("Couldn't find that address — try a more specific one");
  }

  const [lng, lat] = feature.center;
  const neighborhood =
    feature.context?.find((c) => c.id.startsWith("neighborhood"))?.text ||
    feature.context?.find((c) => c.id.startsWith("locality"))?.text ||
    feature.context?.find((c) => c.id.startsWith("place"))?.text ||
    feature.text ||
    null;

  return {
    lat,
    lng,
    placeName: feature.place_name,
    neighborhood,
  };
}

/** Nearest street address for a point, so a dragged pin keeps an honest label. */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("MAPBOX_TOKEN is not configured");

  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "address,poi");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  const data = (await res.json()) as {
    features?: { place_name: string; context?: { id: string; text: string }[]; text?: string }[];
  };
  const feature = data.features?.[0];
  if (!feature) throw new Error("No address near that point");
  const neighborhood =
    feature.context?.find((c) => c.id.startsWith("neighborhood"))?.text ||
    feature.context?.find((c) => c.id.startsWith("locality"))?.text ||
    feature.context?.find((c) => c.id.startsWith("place"))?.text ||
    null;
  return { lat, lng, placeName: feature.place_name, neighborhood };
}

/** Public token for the browser map and address autocomplete. Only `pk.` tokens are safe to ship. */
export function publicMapboxToken(): string | null {
  const t = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || "";
  return t.startsWith("pk.") ? t : null;
}
