import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { boundedJson, CommunityError } from "../http.ts";

export const LINK_QUESTION = "Website or portfolio";
export type IntakeEvent = {
  id: string;
  source: "sample" | "luma";
  name: string;
  startAt: string;
  endAt: string;
  timezone: string;
  projectQuestion: { id: string; label: string } | null;
  linkQuestion: { id: string; label: string } | null;
};
export type CardSource = { project: string; link: string; portfolioSubmitted: boolean };
export type IntakeGuest = {
  id: string;
  name: string;
  revision: string;
  attendance: "rsvp" | "checked-in";
  source: { kind: "luma"; guestId: string } | { kind: "sample"; card: CardSource };
};
export type IntakeSnapshot = { event: IntakeEvent; guests: IntakeGuest[]; startedAt: number; syncedAt: number };

export function eventIsOpen(event: IntakeEvent, now: number): boolean {
  return now >= Date.parse(event.startAt) - 60 * 60_000 && now < Date.parse(event.endAt);
}

const apiOrigin = "https://public-api.luma.com";
export const eventIdSchema = z.string().regex(/^evt-[A-Za-z0-9]{1,64}$/);
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const isoDate = z.string().datetime({ offset: true });
const question = z.object({ id: idSchema, label: z.string().max(400), question_type: z.string(), required: z.boolean().optional() });
const rawEvent = z.object({
  id: eventIdSchema, name: z.string().trim().min(1).max(200), start_at: isoDate, end_at: isoDate,
  timezone: z.string().max(80), registration_questions: z.array(question).max(100).nullish(),
});
const rawGuest = z.object({
  id: idSchema, user_name: z.string().nullish(), user_first_name: z.string().nullish(),
  approval_status: z.string(),
  registration_answers: z.array(z.object({ question_id: idSchema, question_type: z.string(), value: z.unknown() })).max(100).nullish(),
  event_tickets: z.array(z.object({ checked_in_at: isoDate.nullish() })).max(100),
  is_ticket_key_invalidated: z.boolean().optional(),
});
const rawPage = z.object({ entries: z.array(rawGuest).max(100), has_more: z.boolean(), next_cursor: z.string().max(1000).nullish() });

export function cleanLink(input: string): string {
  input = input.trim();
  if (input.length > 400) return "";
  try {
    const url = new URL(/^[\w-]+(?:\.[\w-]+)+(?:[/?#]|$)/.test(input) ? "https://" + input : input);
    const host = url.hostname.replace(/\.+$/, "");
    if (url.protocol !== "https:" || url.username || url.password || url.port || !host.includes(".") ||
        isIP(host) || !/^[a-z0-9.-]+$/.test(host) || host.includes("..") ||
        /(?:^|\.)(?:localhost|local|internal|onion|home|lan|test|invalid)$/.test(host) ||
        /(?:^|\.)(?:linkedin\.com|lnkd\.in)$/.test(host)) return "";
    if (url.hash || [...url.searchParams.keys()].some(key => !/^(?:utm_[a-z0-9_]+|fbclid|gclid)$/i.test(key))) return "";
    url.hostname = host;
    url.search = "";
    return url.href.length <= 400 ? url.href : "";
  } catch { return ""; }
}

const normalizeLabel = (label: string) => label.toLowerCase().trim().replace(/\s+/g, " ");
const tidy = (value: string | null | undefined, limit: number) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
export const comparableName = (name: string) => normalizeLabel(name.normalize("NFKC"));

export function lumaGuestKey(input: string, eventId: string): string | null {
  try {
    const url = new URL(input.trim());
    if (!["https://luma.com", "https://lu.ma"].includes(url.origin) || url.username || url.password ||
        url.pathname !== "/check-in/" + eventId || url.hash) return null;
    const values = url.searchParams.getAll("pk");
    return values.length === 1 && /^g-[A-Za-z0-9_-]{6,100}$/.test(values[0]) ? values[0] : null;
  } catch { return null; }
}

export function publicText(value: string, limit: number): string {
  return tidy(value.slice(0, limit * 4).replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "").replace(
    /(?<!\w)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\w)/g, "",
  ).replace(/https?:\/\/\S+/gi, ""), limit);
}

function matchingQuestion(questions: z.infer<typeof question>[], test: (q: z.infer<typeof question>) => boolean) {
  const matches = questions.filter(test);
  if (matches.length !== 1 || questions.filter(q => q.id === matches[0].id).length !== 1) return null;
  return { id: matches[0].id, label: matches[0].label };
}

function sourceCard(event: IntakeEvent, guest: z.infer<typeof rawGuest>): CardSource {
  const read = (id: string | undefined, type: string) => {
    const matches = (guest.registration_answers ?? []).filter(a => a.question_id === id);
    return matches.length === 1 && matches[0].question_type === type && typeof matches[0].value === "string"
      ? matches[0].value : "";
  };
  const link = read(event.linkQuestion?.id, "url");
  return {
    project: publicText(read(event.projectQuestion?.id, "text"), 600),
    link: cleanLink(link),
    portfolioSubmitted: !!link.trim(),
  };
}

const guestName = (guest: z.infer<typeof rawGuest>) => tidy(guest.user_name, 80) || tidy(guest.user_first_name, 80);
const scopedGuestId = (eventId: string, guestId: string) =>
  createHash("sha256").update(eventId + "\0" + guestId).digest("base64url").slice(0, 32);
const revision = (key: string, event: IntakeEvent, guestId: string, card: CardSource) =>
  createHmac("sha256", key).update(JSON.stringify([event.id, guestId, event.projectQuestion?.id, card])).digest("hex");

export class ProjectQuestionMissing extends CommunityError {
  constructor() { super("Keep one ‘What are you working on?’ text question in Luma to sync this event.", 409); }
}

export class DiscoveryWindowClosed extends CommunityError {
  readonly event: IntakeEvent;
  constructor(event: IntakeEvent) {
    super("Discovery opens during this Sunday’s session.", 409);
    this.event = event;
  }
}

export class LumaIntake {
  private readonly key: string;
  private readonly fetcher: typeof fetch;
  constructor(key: string, fetcher: typeof fetch = fetch) {
    this.key = key;
    this.fetcher = fetcher;
  }

  private async get(path: "/v1/events/get" | "/v1/events/guests/list" | "/v1/events/guests/get", params: Record<string, string>, deadline?: AbortSignal) {
    const url = new URL(path, apiOrigin);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    let res: Response;
    try {
      const timeout = AbortSignal.timeout(6_000);
      res = await this.fetcher(url, {
        headers: { "x-luma-api-key": this.key, accept: "application/json" },
        method: "GET", redirect: "error", cache: "no-store",
        signal: deadline ? AbortSignal.any([deadline, timeout]) : timeout,
      });
    } catch { throw new CommunityError("Luma didn’t respond. Try again.", 502); }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      if (res.status === 401 || res.status === 403) throw new CommunityError("The local Luma key can’t access this event.", 502);
      if (res.status === 429) throw new CommunityError("Luma is rate-limiting requests. Try again in a minute.", 429);
      if (res.status === 404) throw new CommunityError("The configured Luma event wasn’t found.", 404);
      throw new CommunityError("Luma couldn’t complete the request.", 502);
    }
    try { return await boundedJson(res, 1_048_576); }
    catch { throw new CommunityError("Luma returned an unreadable or oversized response.", 502); }
  }

  async event(eventId: string, deadline?: AbortSignal): Promise<IntakeEvent> {
    if (!eventIdSchema.safeParse(eventId).success) throw new CommunityError("Set a valid Luma event ID in local configuration.");
    const value = await this.get("/v1/events/get", { event_id: eventId }, deadline);
    const raw = value && typeof value === "object" && "event" in value ? value.event : value;
    const parsed = rawEvent.safeParse(raw);
    if (!parsed.success || parsed.data.id !== eventId || Date.parse(parsed.data.start_at) >= Date.parse(parsed.data.end_at)) {
      throw new CommunityError("Luma returned unexpected event metadata.", 502);
    }
    const e = parsed.data;
    const questions = e.registration_questions ?? [];
    return {
      id: e.id, source: "luma", name: e.name, startAt: e.start_at, endAt: e.end_at, timezone: e.timezone,
      projectQuestion: matchingQuestion(questions, q => q.question_type === "text" &&
        /^(?:what are you working on|what are you making this sunday)(?:\?.*| \(.*\))?$/.test(normalizeLabel(q.label))),
      linkQuestion: matchingQuestion(questions, q => q.question_type === "url" && q.required === false &&
        [normalizeLabel(LINK_QUESTION), "link to what you make", "website", "portfolio", "website/portfolio link", "website or portfolio link"]
          .includes(normalizeLabel(q.label).replace(/ \(optional\)$|\?$/g, ""))),
    };
  }

  async snapshot(eventId: string, openAt?: number): Promise<IntakeSnapshot> {
    const startedAt = Date.now();
    const deadline = AbortSignal.timeout(18_000);
    const event = await this.event(eventId, deadline);
    if (openAt !== undefined && !eventIsOpen(event, openAt)) throw new DiscoveryWindowClosed(event);
    if (!event.projectQuestion) throw new ProjectQuestionMissing();
    const guests: IntakeGuest[] = [];
    const seen = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 6; page++) {
      const params: Record<string, string> = { event_id: event.id, approval_status: "approved", pagination_limit: "100" };
      if (cursor) params.pagination_cursor = cursor;
      const result = rawPage.safeParse(await this.get("/v1/events/guests/list", params, deadline));
      if (!result.success) throw new CommunityError("Luma returned an unexpected guest list. Nothing was imported.", 502);
      for (const guest of result.data.entries) {
        if (seen.has(guest.id)) throw new CommunityError("Luma returned a changing guest list. Try again.", 502);
        seen.add(guest.id);
        const name = guestName(guest);
        if (!name || guest.approval_status !== "approved") continue;
        guests.push({
          id: scopedGuestId(event.id, guest.id),
          name,
          attendance: guest.event_tickets.length === 1 && guest.event_tickets[0].checked_in_at ? "checked-in" : "rsvp",
          revision: revision(this.key, event, guest.id, sourceCard(event, guest)),
          source: { kind: "luma", guestId: guest.id },
        });
      }
      if (!result.data.has_more) return { event, startedAt, syncedAt: Date.now(), guests };
      cursor = result.data.next_cursor || undefined;
      if (!cursor || cursors.has(cursor)) break;
      cursors.add(cursor);
    }
    throw new CommunityError("Couldn’t read the complete guest list. Nothing was imported.", 502);
  }

  async verifyGuest(eventId: string, key: string): Promise<string> {
    if (!eventIdSchema.safeParse(eventId).success || !/^g-[A-Za-z0-9_-]{6,100}$/.test(key)) {
      throw new CommunityError("Use the QR code from your Luma ticket.");
    }
    const denied = () => new CommunityError("That ticket could not be verified for this Sunday.", 403);
    const raw = await this.get("/v1/events/guests/get", { event_id: eventId, id: key }).catch(error => {
      if (error instanceof CommunityError && error.status === 404) throw denied();
      throw error;
    });
    const guest = rawGuest.safeParse(raw);
    if (!guest.success || guest.data.approval_status !== "approved" || guest.data.is_ticket_key_invalidated ||
        guest.data.event_tickets.length !== 1) throw denied();
    return scopedGuestId(eventId, guest.data.id);
  }

  async cardSource(event: IntakeEvent, entry: IntakeGuest): Promise<CardSource> {
    if (event.source !== "luma" || !event.projectQuestion || entry.source.kind !== "luma") {
      throw new CommunityError("This RSVP can’t be loaded. Ask a host to refresh.", 409);
    }
    const { guestId } = entry.source;
    const result = rawGuest.safeParse(await this.get("/v1/events/guests/get", { event_id: event.id, id: guestId }));
    if (!result.success || result.data.id !== guestId || result.data.approval_status !== "approved" ||
        comparableName(guestName(result.data)) !== comparableName(entry.name)) {
      throw new CommunityError("This RSVP changed. Ask a host to refresh.", 409);
    }
    const card = sourceCard(event, result.data);
    if (revision(this.key, event, guestId, card) !== entry.revision) {
      throw new CommunityError("Your RSVP changed. Ask a host to refresh.", 409);
    }
    return card;
  }
}
