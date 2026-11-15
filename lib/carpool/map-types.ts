/** Shapes the map component draws. Shared by the host board and the member page. */

export type MapPoint = { offerId: string; lat: number; lng: number; name: string };

export type MapCar = {
  id: string;
  color: string;
  driver: MapPoint;
  stops: (MapPoint & { order: number; confirmed: boolean })[];
};

/** Someone shown only approximately (rounded to ~1 km), with or without a first name. */
export type GhostPin = { lat: number; lng: number; label: string | null };

export type MemberMap = {
  /** The member's own exact pin, unless it's already drawn as part of `car`. */
  self: MapPoint | null;
  /** Their car with exact pins and a route, only once a host has confirmed it. */
  car: MapCar | null;
  ghosts: GhostPin[];
};
