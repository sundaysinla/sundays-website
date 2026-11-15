const LUMA_BASE = "https://public-api.luma.com";

export class LumaError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "LumaError";
  }
}

function getApiKey() {
  const key = process.env.LUMA_API_KEY;
  if (!key) {
    throw new LumaError("LUMA_API_KEY is not configured");
  }
  return key;
}

async function lumaFetch<T>(
  path: string,
  options: { method?: string; query?: Record<string, string | undefined>; body?: unknown } = {}
): Promise<T> {
  const url = new URL(path, LUMA_BASE);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method: options.method || "GET",
    headers: {
      "x-luma-api-key": getApiKey(),
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    next: { revalidate: 0 },
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new LumaError(
      `Luma API ${res.status}: ${typeof data === "object" && data && "message" in data ? String((data as { message: unknown }).message) : text || res.statusText}`,
      res.status,
      data
    );
  }

  return data as T;
}

export type LumaRegistrationQuestion = {
  id: string;
  label?: string;
  question_type?: string;
  required?: boolean;
};

export type LumaEvent = {
  id?: string;
  api_id?: string;
  name: string;
  cover_url?: string | null;
  start_at: string;
  end_at?: string;
  timezone?: string;
  url?: string;
  geo_address_json?: {
    full_address?: string;
    city?: string;
    region?: string;
    address?: string;
  } | null;
  coordinate?: {
    latitude?: number | string;
    longitude?: number | string;
  } | null;
  geo_latitude?: string | null;
  geo_longitude?: string | null;
  registration_questions?: LumaRegistrationQuestion[];
  require_approval?: boolean;
};

export type LumaGuest = {
  id?: string;
  api_id?: string;
  guest_id?: string;
  email?: string;
  user_email?: string;
  name?: string | null;
  user_name?: string | null;
  user_first_name?: string | null;
  user_last_name?: string | null;
  approval_status?: string;
  checked_in_at?: string | null;
  registration_answers?: unknown;
};

function eventId(event: LumaEvent): string {
  return event.api_id || event.id || "";
}

export function parseEventCoords(event: LumaEvent): { lat: number | null; lng: number | null } {
  const latRaw = event.coordinate?.latitude ?? event.geo_latitude;
  const lngRaw = event.coordinate?.longitude ?? event.geo_longitude;
  const lat = latRaw != null && latRaw !== "" ? Number(latRaw) : NaN;
  const lng = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : NaN;
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

export function eventAddress(event: LumaEvent): string | null {
  const geo = event.geo_address_json;
  if (!geo) return null;
  return geo.full_address || geo.address || [geo.city, geo.region].filter(Boolean).join(", ") || null;
}

export async function listCalendarEvents(opts?: {
  after?: string;
  before?: string;
  pagination_limit?: number;
}) {
  const data = await lumaFetch<{ entries?: LumaEvent[]; next_cursor?: string } | LumaEvent[]>(
    "/v1/calendars/events/list",
    {
      query: {
        after: opts?.after,
        before: opts?.before,
        pagination_limit: opts?.pagination_limit?.toString() ?? "20",
      },
    }
  );

  if (Array.isArray(data)) return { entries: data, next_cursor: undefined };
  return { entries: data.entries ?? [], next_cursor: data.next_cursor };
}

export async function getEvent(eventIdParam: string) {
  const data = await lumaFetch<{ event?: LumaEvent } | LumaEvent>("/v1/events/get", {
    query: { id: eventIdParam, event_id: eventIdParam },
  });
  if (data && typeof data === "object" && "event" in data && data.event) {
    return data.event;
  }
  return data as LumaEvent;
}

export type LumaHost = {
  id?: string;
  api_id?: string;
  email?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
};

/** The event's hosts as listed on Luma (the `hosts` array on events/get). */
export async function getEventHosts(eventIdParam: string): Promise<LumaHost[]> {
  const data = await lumaFetch<{ hosts?: LumaHost[]; event?: { hosts?: LumaHost[] } }>("/v1/events/get", {
    query: { id: eventIdParam, event_id: eventIdParam },
  });
  return data?.hosts ?? data?.event?.hosts ?? [];
}

export async function listGuests(eventIdParam: string, approvalStatus?: string) {
  const all: LumaGuest[] = [];
  let cursor: string | undefined;

  do {
    const data = await lumaFetch<{
      entries?: LumaGuest[];
      next_cursor?: string;
    }>("/v1/events/guests/list", {
      query: {
        event_id: eventIdParam,
        approval_status: approvalStatus,
        pagination_cursor: cursor,
        pagination_limit: "100",
      },
    });
    all.push(...(data.entries ?? []));
    cursor = data.next_cursor;
  } while (cursor);

  return all;
}

export async function addGuest(params: {
  eventId: string;
  email: string;
  name?: string | null;
  registrationAnswers?: { question_id: string; value: string | boolean | string[] }[];
  approvalStatus?: "approved" | "pending_approval" | "waitlist";
  sendEmail?: boolean;
}) {
  return lumaFetch("/v1/events/guests/add", {
    method: "POST",
    body: {
      event_id: params.eventId,
      guests: [
        {
          email: params.email,
          name: params.name ?? undefined,
          registration_answers: params.registrationAnswers,
        },
      ],
      approval_status: params.approvalStatus,
      send_email: params.sendEmail ?? true,
    },
  });
}

export { eventId as resolveLumaEventId };
