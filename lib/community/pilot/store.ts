import { createHash, randomBytes } from "node:crypto";
import { chmodSync, closeSync, mkdirSync, openSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CommunityError } from "../http.ts";
import { memberContext } from "./access.ts";
import { comparableName, eventIsOpen, ProjectQuestionMissing, type IntakeEvent, type IntakeGuest, type IntakeSnapshot } from "./intake.ts";
import { matchPeople, type Card, type Person, type PilotMatch } from "./matching.ts";
import type { Portfolio } from "./portfolio.ts";

export const CLAIM_TTL_MS = 20 * 60_000;
export const MEMBER_TTL_MS = 12 * 60 * 60_000;
const liveFreshnessMs = 15 * 60_000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");

type Prepared = { id: string; project: string; portfolio: Portfolio | null; portfolioUnavailable: boolean };
type Guest = IntakeGuest & { prepared: Prepared | null; shared: { includePortfolio: boolean; hidden?: boolean; directory?: true } | null; claimBlocked?: boolean };
type Preparation = { event: IntakeEvent; guest: IntakeGuest; prepared: boolean; startedAt: number };
type Event = Omit<IntakeSnapshot, "guests"> & { guests: Guest[]; blocked: boolean };
type Access = { hash: string; eventId: string; guestId: string; expiresAt: number };
type State = { version: 2; events: Event[]; claims: Access[]; sessions: Access[]; withdrawn: string[]; blockWatermarks: { eventId: string; at: number }[] };

export type MemberView = {
  context: string;
  event: { name: string };
  name: string;
  card: Card | null;
  revision: string | null;
  shared: boolean;
  includePortfolio: boolean;
  portfolioUnavailable: boolean;
  discoveryMessage: string | null;
};
export type PilotDiscovery = {
  people: Person[]; matches: PilotMatch[]; query: string; expiresAt: number;
  eventName?: string; roomMessage?: string; member?: MemberView;
};
export type HostEvent = {
  event: IntakeEvent;
  syncedAt: number;
  blocked: boolean;
  guests: { id: string; name: string; attendance: IntakeGuest["attendance"]; shared: boolean; claimBlocked: boolean }[];
};

function validAccess(state: State, session: string, now: number) {
  const access = session && state.sessions.find(record => record.hash === digest(session) && record.expiresAt > now);
  const event = access && state.events.find(record => record.event.id === access.eventId);
  const guest = event && access && event.guests.find(record => record.id === access.guestId);
  if (!access || !event || !guest) throw new CommunityError("Open your Luma ticket again.", 401);
  return { access, event, guest };
}

function ambiguousClaim(event: Event, guest: Guest): boolean {
  return guest.claimBlocked ?? event.guests.some(other =>
    other.id !== guest.id && comparableName(other.name) === comparableName(guest.name)
  );
}

const isShared = (guest: Guest) => !!guest.shared && !guest.shared.hidden;

function preparationAccess(state: State, session: string, now: number, target?: Preparation) {
  const current = validAccess(state, session, now);
  const { event, guest } = current;
  if (event.blocked) throw new CommunityError("RSVP cards are unavailable for this event.", 409);
  if (target) {
    const blockedAt = state.blockWatermarks.find(record => record.eventId === event.event.id)?.at ?? -1;
    if (blockedAt >= target.startedAt || guest.revision !== target.guest.revision ||
        event.event.id !== target.event.id || guest.id !== target.guest.id) {
      throw new CommunityError("Your RSVP changed. Preview your card again.", 409);
    }
  }
  return current;
}

function roomMessage(event: Event, now: number): string | null {
  if (event.event.source === "luma") {
    if (event.blocked) return "Discovery is unavailable for this event.";
    if (!eventIsOpen(event.event, now)) return "Introductions open during this session.";
    if (event.syncedAt <= now - liveFreshnessMs) return "Check-ins are updating. Try again shortly.";
  }
  return null;
}

function discoveryMessage(event: Event, guest: Guest, now: number): string | null {
  return roomMessage(event, now) ?? (guest.attendance === "checked-in" ? null : "Check in on Luma to get your pairing.");
}

function cardFor(guest: Guest, includePortfolio: boolean): Card | null {
  return guest.prepared && {
    name: guest.name, project: guest.prepared.project, portfolio: includePortfolio ? guest.prepared.portfolio : null,
  };
}

function memberView(event: Event, guest: Guest, session: string, now: number): MemberView {
  return {
    context: memberContext(session), event: { name: event.event.name }, name: guest.name, card: cardFor(guest, true),
    revision: guest.prepared?.id ?? null, shared: isShared(guest),
    includePortfolio: guest.shared?.includePortfolio ?? !!guest.prepared?.portfolio,
    portfolioUnavailable: guest.prepared?.portfolioUnavailable ?? false,
    discoveryMessage: discoveryMessage(event, guest, now),
  };
}

function discovery(event: Event, query: string, now: number, options: {
  viewer?: Guest; sessionExpiry?: number; directoryOnly?: boolean;
} = {}): PilotDiscovery {
  const { viewer, sessionExpiry = Infinity, directoryOnly = false } = options;
  const people = event.guests.flatMap(candidate => {
    if (candidate.id === viewer?.id || !candidate.shared || candidate.shared.hidden || candidate.attendance !== "checked-in") return [];
    if (directoryOnly && !candidate.shared.directory) return [];
    const card = cardFor(candidate, candidate.shared.includePortfolio);
    return card ? [{ id: candidate.id, card }] : [];
  });
  const viewerCard = viewer ? cardFor(viewer, viewer.shared?.includePortfolio ?? true) : null;
  const expiresAt = Math.min(now + 60_000, sessionExpiry,
    ...(event.event.source === "luma" ? [event.syncedAt + liveFreshnessMs, Date.parse(event.event.endAt)] : []));
  return { ...matchPeople(people, viewerCard, query), query, expiresAt, eventName: event.event.name };
}

export class PilotStore {
  private readonly path: string;
  constructor(path: string) { this.path = path; }

  // One small state document in SQLite keeps a complete sync or claim atomic across workers.
  private access<T>(operation: (state: State) => T, write = false): T {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    closeSync(openSync(this.path, "a", 0o600));
    chmodSync(this.path, 0o600);
    const db = new DatabaseSync(this.path);
    try {
      db.exec("PRAGMA busy_timeout=3000; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS pilot_v1 (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)");
      if (write) db.exec("BEGIN IMMEDIATE");
      const row = db.prepare("SELECT data FROM pilot_v1 WHERE id = 1").get();
      const previous = row ? JSON.parse(String(row.data)) : null;
      // Older cards contained editable fields and a different approval. Keep removal requests.
      const state: State = previous?.version === 2 ? previous : {
        version: 2, events: [], claims: [], sessions: [], withdrawn: previous?.withdrawn ?? [], blockWatermarks: [],
      };
      const result = operation(state);
      if (write) {
        db.prepare("INSERT INTO pilot_v1 (id, data) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET data = excluded.data").run(JSON.stringify(state));
        db.exec("COMMIT");
      }
      return result;
    } finally { db.close(); }
  }

  sync(snapshot: IntakeSnapshot): void {
    if (snapshot.event.source === "luma" && !snapshot.event.projectQuestion) throw new ProjectQuestionMissing();
    this.access(state => {
      const eventId = snapshot.event.id;
      const previous = state.events.find(e => e.event.id === eventId);
      const blockedAt = state.blockWatermarks.find(record => record.eventId === eventId)?.at;
      if (blockedAt !== undefined && snapshot.startedAt <= blockedAt) throw new CommunityError("A newer event check blocked this sync.", 409);
      if (previous && previous.startedAt > snapshot.startedAt) throw new CommunityError("A newer sync has already finished.", 409);
      if (previous && previous.event.source !== snapshot.event.source) throw new CommunityError("This event belongs to a different source.", 409);
      const saved = new Map(previous?.guests.map(guest => [guest.id, guest]));
      const withdrawn = new Set(state.withdrawn);
      const keep = new Set<string>();
      const nameCounts = new Map<string, number>();
      for (const guest of snapshot.guests) {
        const name = comparableName(guest.name);
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
      }
      const guests: Guest[] = snapshot.guests
        .filter(guest => !withdrawn.has(digest(eventId + "\0" + guest.id)))
        .map(guest => {
          const old = saved.get(guest.id);
          const name = comparableName(guest.name);
          const samePerson = old && comparableName(old.name) === name;
          const claimBlocked = (nameCounts.get(name) ?? 0) > 1;
          if (samePerson) keep.add(guest.id);
          if (samePerson && !previous?.blocked && old.revision === guest.revision) {
            return { ...guest, claimBlocked, prepared: old.prepared, shared: old.shared };
          }
          return { ...guest, claimBlocked, prepared: null, shared: null };
        });
      const valid = (record: Access) => record.expiresAt > snapshot.syncedAt &&
        (record.eventId !== eventId || keep.has(record.guestId));
      state.claims = state.claims.filter(valid);
      state.sessions = state.sessions.filter(valid);
      state.events = [...state.events.filter(e => e.event.id !== eventId), { ...snapshot, guests, blocked: false }];
    }, true);
  }

  block(eventId: string, inspectedAt: number): void {
    this.access(state => {
      const previous = state.blockWatermarks.find(record => record.eventId === eventId);
      if (!previous || previous.at <= inspectedAt) {
        state.blockWatermarks = [...state.blockWatermarks.filter(record => record.eventId !== eventId), { eventId, at: inspectedAt }];
      }
      const event = state.events.find(e => e.event.id === eventId);
      if (event && event.startedAt <= inspectedAt) {
        event.blocked = true;
        for (const guest of event.guests) { guest.prepared = null; guest.shared = null; }
      }
    }, true);
  }

  updateClosedWindow(metadata: IntakeEvent, inspectedAt: number): void {
    this.access(state => {
      const event = state.events.find(record => record.event.id === metadata.id && record.event.source === "luma");
      if (!event || event.startedAt > inspectedAt) return;
      event.event = metadata;
      event.startedAt = inspectedAt;
      event.syncedAt = 0;
    }, true);
  }

  hostEvents(): HostEvent[] {
    return this.access(state => state.events.map(record => ({
      event: record.event, syncedAt: record.syncedAt, blocked: record.blocked, guests: record.guests.map(g => ({
        id: g.id, name: g.name, claimBlocked: ambiguousClaim(record, g),
        attendance: g.attendance, shared: isShared(g),
      })),
    })));
  }

  snapshotTime(eventId: string): number {
    return this.access(state => state.events.find(event => event.event.id === eventId)?.syncedAt ?? 0);
  }

  roomOpen(eventId: string, now: number): boolean {
    return this.access(state => {
      const event = state.events.find(record => record.event.id === eventId && record.event.source === "luma");
      return !!event && !roomMessage(event, now);
    });
  }

  join(eventId: string, id: string, now: number): string {
    return this.access(state => {
      const event = state.events.find(record => record.event.id === eventId && record.event.source === "luma");
      const guest = event?.guests.find(record => record.id === id);
      if (!event || !guest || roomMessage(event, now)) throw new CommunityError("This Luma RSVP is unavailable.", 403);
      const value = token();
      state.sessions = state.sessions.filter(session => session.expiresAt > now &&
        (session.eventId !== eventId || session.guestId !== id));
      state.sessions.push({ hash: digest(value), eventId, guestId: id, expiresAt: now + MEMBER_TTL_MS });
      return value;
    }, true);
  }

  leave(session: string): void {
    const hash = digest(session);
    this.access(state => { state.sessions = state.sessions.filter(record => record.hash !== hash); }, true);
  }

  issue(eventId: string, id: string, now: number): string {
    return this.access(state => {
      const event = state.events.find(e => e.event.id === eventId);
      const guest = event?.guests.find(g => g.id === id);
      if (!event || event.blocked || !guest) throw new CommunityError("This guest has no available draft.", 404);
      if (ambiguousClaim(event, guest)) throw new CommunityError("More than one guest has the same RSVP name. This claim can’t be issued safely.", 409);
      const value = token();
      state.claims = state.claims.filter(c => c.expiresAt > now && !(c.eventId === eventId && c.guestId === id));
      state.claims.push({ hash: digest(value), eventId, guestId: id, expiresAt: now + CLAIM_TTL_MS });
      return value;
    }, true);
  }

  claim(value: string, now: number): string {
    return this.access(state => {
      const claim = state.claims.find(c => c.hash === digest(value) && c.expiresAt > now);
      const event = claim && state.events.find(e => e.event.id === claim.eventId);
      const guest = event && claim && event.guests.find(g => g.id === claim.guestId);
      if (!claim || !event || event.blocked || !guest || ambiguousClaim(event, guest)) {
        throw new CommunityError("This claim link is invalid or expired. Ask a host for a new one.", 403);
      }
      const session = token();
      state.claims = state.claims.filter(c => c !== claim && c.expiresAt > now);
      state.sessions = state.sessions.filter(s => s.expiresAt > now && !(s.eventId === claim.eventId && s.guestId === claim.guestId));
      state.sessions.push({ ...claim, hash: digest(session), expiresAt: now + MEMBER_TTL_MS });
      return session;
    }, true);
  }

  view(session: string, now: number, eventId?: string): MemberView {
    return this.access(state => {
      const { event, guest } = validAccess(state, session, now);
      if (eventId && event.event.id !== eventId) throw new CommunityError("Open your Luma ticket for this Sunday.", 401);
      return memberView(event, guest, session, now);
    });
  }

  preparation(session: string, now: number): Preparation {
    return this.access(state => {
      const { event, guest } = preparationAccess(state, session, now);
      return { event: event.event, guest, prepared: !!guest.prepared, startedAt: now };
    });
  }

  assertPreparation(session: string, target: Preparation, now: number): void {
    this.access(state => { preparationAccess(state, session, now, target); });
  }

  savePreparation(session: string, target: Preparation, prepared: Omit<Prepared, "id">, now: number): void {
    this.access(state => {
      const { guest } = preparationAccess(state, session, now, target);
      guest.prepared ??= { ...prepared, id: token() };
    }, true);
  }

  share(session: string, revision: string, includePortfolio: boolean, now: number, inDirectory = false): void {
    this.access(state => {
      const { event, guest } = validAccess(state, session, now);
      if (event.blocked) throw new CommunityError("RSVP cards are unavailable for this event.", 409);
      const problem = inDirectory ? discoveryMessage(event, guest, now) : null;
      if (problem) throw new CommunityError(problem, 409);
      if (guest.prepared?.id !== revision) throw new CommunityError("Preview the current card before sharing.", 409);
      guest.shared = {
        includePortfolio: includePortfolio && !!guest.prepared.portfolio,
        ...(inDirectory ? { directory: true } : {}),
      };
      guest.prepared.id = token();
    }, true);
  }

  hide(session: string, now: number): void {
    this.access(state => {
      const { guest } = validAccess(state, session, now);
      if (guest.shared) guest.shared.hidden = true;
      if (guest.prepared) guest.prepared.id = token();
    }, true);
  }

  withdraw(session: string, now: number): void {
    this.access(state => {
      const { event, guest } = validAccess(state, session, now);
      const other = (access: Access) => access.eventId !== event.event.id || access.guestId !== guest.id;
      event.guests = event.guests.filter(g => g.id !== guest.id);
      state.sessions = state.sessions.filter(other);
      state.claims = state.claims.filter(other);
      state.withdrawn.push(digest(event.event.id + "\0" + guest.id));
    }, true);
  }

  introductions(session: string, query: string, now: number): PilotDiscovery {
    return this.access(state => {
      const { event, guest, access } = validAccess(state, session, now);
      const problem = discoveryMessage(event, guest, now);
      if (problem) throw new CommunityError(problem, 409);
      return discovery(event, query, now, { viewer: guest, sessionExpiry: access.expiresAt });
    });
  }

  directory(eventId: string, query: string, now: number, session = ""): PilotDiscovery {
    return this.access(state => {
      const event = state.events.find(record => record.event.id === eventId && record.event.source === "luma");
      const access = session && state.sessions.find(record =>
        record.eventId === eventId && record.hash === digest(session) && record.expiresAt > now,
      );
      const guest = access && event ? event.guests.find(guest => guest.id === access.guestId) : undefined;
      if (session && !guest) throw new CommunityError("Open your Luma ticket again.", 401);
      const viewer = guest?.attendance === "checked-in" ? guest : undefined;
      const message = event ? roomMessage(event, now) : "Discovery opens during this Sunday’s session.";
      const result = event && !message
        ? discovery(event, query, now, { viewer, sessionExpiry: access ? access.expiresAt : Infinity, directoryOnly: !viewer })
        : { people: [], matches: [], query, expiresAt: now + 60_000, eventName: event?.event.name, roomMessage: message ?? undefined };
      return event && guest ? { ...result, member: memberView(event, guest, session, now) } : result;
    });
  }
}
