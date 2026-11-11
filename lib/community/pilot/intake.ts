import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { boundedJson, CommunityError } from "../http.ts";

export const CONSENT_QUESTION = "Use my RSVP answers and shared link to prepare a private Sundays intro card for my review.";
export const LINK_QUESTION = "Link to what you make";
export type IntakeEvent = {
  id: string;
  source: "sample" | "luma";
  name: string;
  startAt: string;
  endAt: string;
  timezone: string;
  projectQuestion: { id: string; label: string } | null;
  consentQuestion: { id: string; label: string } | null;
  linkQuestion: { id: string; label: string } | null;
};
export type Card = { name: string; project: string; ask: string; offer: string; link: string; shareLink: boolean };
export type IntakeGuest = { id: string; draft: Card; attendance: "rsvp" | "checked-in"; claimBlocked?: boolean };
export type IntakeSnapshot = { event: IntakeEvent; guests: IntakeGuest[]; startedAt: number; syncedAt: number };

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
});
const rawPage = z.object({ entries: z.array(rawGuest).max(100), has_more: z.boolean(), next_cursor: z.string().max(1000).nullish() });

export function cleanLink(input: string): string {
  if (input.length > 400) return "";
  try {
    const url = new URL(input);
    const host = url.hostname;
    if (url.protocol !== "https:" || url.username || url.password || url.port || !host.includes(".") ||
        isIP(host) || host.endsWith(".localhost") || host.endsWith(".local")) return "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch { return ""; }
}

export const cardSchema = z.object({
  name: z.string().trim().min(1).max(80),
  project: z.string().trim().min(1).max(300),
  ask: z.string().trim().max(60),
  offer: z.string().trim().max(60),
  link: z.string().trim().max(400).transform(cleanLink),
  shareLink: z.boolean(),
}).strict().transform(card => ({ ...card, shareLink: !!card.link && card.shareLink }));

const normalizeLabel = (label: string) => label.toLowerCase().trim().replace(/\s+/g, " ");
const tidy = (value: string | null | undefined, limit: number) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
export const comparableName = (name: string) => normalizeLabel(name.normalize("NFKC"));

function matchingQuestion(questions: z.infer<typeof question>[], test: (q: z.infer<typeof question>) => boolean) {
  const matches = questions.filter(test);
  if (matches.length !== 1 || questions.filter(q => q.id === matches[0].id).length !== 1) return null;
  return { id: matches[0].id, label: matches[0].label };
}

function projectGuest(event: IntakeEvent, guest: z.infer<typeof rawGuest>): IntakeGuest | null {
  if (guest.approval_status !== "approved" || !event.consentQuestion) return null;
  const read = (id: string, types: string[]) => {
    const matches = (guest.registration_answers ?? []).filter(a => a.question_id === id);
    return matches.length === 1 && types.includes(matches[0].question_type) ? matches[0].value : undefined;
  };
  if (read(event.consentQuestion.id, ["agree-check"]) !== true) return null;
  const name = tidy(guest.user_name || guest.user_first_name, 80);
  if (!name) return null;
  const note = event.projectQuestion ? read(event.projectQuestion.id, ["text"]) : undefined;
  const project = typeof note === "string" ? tidy(note, 300) : "";
  // A suggested ask is editable in the private draft. Offers always come from the member.
  const ask = tidy(project.match(/\b(?:could use (?:help|a hand) with|need help with|looking for help with)\s+([^.!?]+)/i)?.[1], 60);
  const rawLink = event.linkQuestion ? read(event.linkQuestion.id, ["url"]) : undefined;
  return {
    id: createHash("sha256").update(event.id + "\0" + guest.id).digest("base64url").slice(0, 32),
    attendance: guest.event_tickets.length === 1 && guest.event_tickets[0].checked_in_at ? "checked-in" : "rsvp",
    draft: { name, project, ask, offer: "", link: typeof rawLink === "string" ? cleanLink(rawLink) : "", shareLink: false },
  };
}

export class LumaIntake {
  private readonly key: string;
  private readonly fetcher: typeof fetch;
  constructor(key: string, fetcher: typeof fetch = fetch) {
    this.key = key;
    this.fetcher = fetcher;
  }

  private async get(path: "/v1/events/get" | "/v1/events/guests/list", params: Record<string, string>, deadline?: AbortSignal) {
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
        ["what are you working on?", "what are you making this sunday?"].includes(normalizeLabel(q.label))),
      consentQuestion: matchingQuestion(questions, q => q.question_type === "agree-check" && q.required === false &&
        normalizeLabel(q.label) === normalizeLabel(CONSENT_QUESTION)),
      linkQuestion: matchingQuestion(questions, q => q.question_type === "url" && q.required === false &&
        normalizeLabel(q.label) === normalizeLabel(LINK_QUESTION)),
    };
  }

  async snapshot(eventId: string): Promise<IntakeSnapshot> {
    const startedAt = Date.now();
    const deadline = AbortSignal.timeout(18_000);
    const event = await this.event(eventId, deadline);
    if (!event.consentQuestion) throw new CommunityError("Add the optional intro-card opt-in in Luma before syncing guests.", 409);
    const guests: IntakeGuest[] = [];
    const seen = new Set<string>();
    const cursors = new Set<string>();
    const nameCounts = new Map<string, number>();
    let cursor: string | undefined;
    for (let page = 0; page < 6; page++) {
      const params: Record<string, string> = { event_id: event.id, pagination_limit: "100" };
      if (cursor) params.pagination_cursor = cursor;
      const result = rawPage.safeParse(await this.get("/v1/events/guests/list", params, deadline));
      if (!result.success) throw new CommunityError("Luma returned an unexpected guest list. Nothing was imported.", 502);
      for (const guest of result.data.entries) {
        if (seen.has(guest.id)) throw new CommunityError("Luma returned a changing guest list. Try again.", 502);
        seen.add(guest.id);
        const name = comparableName(tidy(guest.user_name || guest.user_first_name, 80));
        if (name && guest.approval_status === "approved") nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
        const projected = projectGuest(event, guest);
        if (projected) guests.push(projected);
      }
      if (!result.data.has_more) return {
        event, startedAt, syncedAt: Date.now(),
        guests: guests.map(guest => nameCounts.get(comparableName(guest.draft.name))! > 1 ? { ...guest, claimBlocked: true } : guest),
      };
      cursor = result.data.next_cursor || undefined;
      if (!cursor || cursors.has(cursor)) break;
      cursors.add(cursor);
    }
    throw new CommunityError("Couldn’t read the complete guest list. Nothing was imported.", 502);
  }
}
