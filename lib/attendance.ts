/**
 * Who was in the room. Attendance rows come from Luma's guest list (synced per
 * event for hosts) plus walk-ins added at the door. Check-in is recorded here,
 * not on Luma. Meetings ("I met…") hang off attendance rows so they survive a
 * guest later claiming their account.
 */

import { prisma } from "@/lib/db";
import { getEventHosts, listGuests, type LumaGuest } from "@/lib/luma";
import type { Prisma } from "@prisma/client";

const userSelect = {
  select: {
    id: true,
    name: true,
    email: true,
    profile: { select: { displayName: true, avatarUrl: true, school: true, contactEmail: true } },
  },
} as const;

type AttRow = {
  id: string;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  status: string;
  checkedInAt: Date | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    profile: { displayName: string | null; avatarUrl: string | null; school: string | null; contactEmail: string } | null;
  } | null;
};

export type AttendeeView = {
  id: string;
  name: string;
  firstName: string;
  initial: string;
  avatarUrl: string | null;
  school: string | null;
  guest: boolean;
  status: string;
  checkedInAt: string | null;
  firstTime: boolean;
  email: string | null;
};

export function attendeeName(a: AttRow): string {
  return (
    a.user?.profile?.displayName?.trim() ||
    a.user?.name?.trim() ||
    a.guestName?.trim() ||
    a.user?.profile?.contactEmail ||
    a.user?.email ||
    a.guestEmail ||
    "Someone"
  );
}

function personKey(a: AttRow): string {
  return a.userId ? `u:${a.userId}` : a.guestEmail ? `g:${a.guestEmail}` : `a:${a.id}`;
}

function toView(a: AttRow, firstTime: boolean): AttendeeView {
  const name = attendeeName(a);
  return {
    id: a.id,
    name,
    firstName: name.split(/\s+/)[0],
    initial: (name[0] ?? "?").toUpperCase(),
    avatarUrl: a.user?.profile?.avatarUrl ?? null,
    school: a.user?.profile?.school ?? null,
    guest: !a.userId,
    status: a.status,
    checkedInAt: a.checkedInAt?.toISOString() ?? null,
    firstTime,
    email: a.user?.profile?.contactEmail || a.user?.email || a.guestEmail || null,
  };
}

async function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      OR: [{ email }, { profile: { contactEmail: email } }, { lumaLink: { lumaGuestEmail: email } }],
    },
    select: { id: true },
  });
}

function guestName(g: LumaGuest): string | null {
  const full = g.user_name?.trim() || [g.user_first_name, g.user_last_name].filter(Boolean).join(" ").trim() || g.name?.trim();
  return full || null;
}

// ─── Sync ────────────────────────────────────────────────────────────────────

const lastGuestSync = new Map<string, number>();
const GUEST_SYNC_GAP_MS = 5 * 60 * 1000;

/**
 * Pull the event's Luma guest list into attendance rows, and its hosts, who
 * are checked in automatically once the Sunday is under way. Guests' check-in
 * state is never touched here.
 */
export async function syncEventGuests(lumaEventId: string, opts?: { force?: boolean }) {
  if (!process.env.LUMA_API_KEY) return { synced: 0, skipped: true as const };
  const last = lastGuestSync.get(lumaEventId) ?? 0;
  if (!opts?.force && Date.now() - last < GUEST_SYNC_GAP_MS) return { synced: 0, skipped: true as const };
  lastGuestSync.set(lumaEventId, Date.now());

  const event = await prisma.eventCache.findUnique({ where: { lumaEventId }, select: { startAt: true } });
  const underWay = !!event && Date.now() >= event.startAt.getTime() - 3600 * 1000;
  const hostCheckin = underWay ? new Date(Math.max(event!.startAt.getTime(), Math.min(Date.now(), event!.startAt.getTime()))) : null;

  let synced = 0;
  try {
    const hosts = await getEventHosts(lumaEventId);
    for (const h of hosts) {
      const email = (h.email || "").toLowerCase().trim();
      if (!email) continue;
      const name = h.name?.trim() || [h.first_name, h.last_name].filter(Boolean).join(" ").trim() || null;
      const user = await findUserByEmail(email);
      const checkin = hostCheckin ? { checkedInAt: hostCheckin, checkedInBy: "luma-host" } : {};
      if (user) {
        const mine = await prisma.attendance.findUnique({ where: { userId_lumaEventId: { userId: user.id, lumaEventId } } });
        if (mine) {
          await prisma.attendance.update({ where: { id: mine.id }, data: { status: "host", ...(mine.checkedInAt ? {} : checkin) } });
        } else {
          await prisma.attendance.create({ data: { userId: user.id, lumaEventId, status: "host", ...checkin } });
        }
      } else {
        const existing = await prisma.attendance.findFirst({ where: { lumaEventId, guestEmail: email } });
        if (existing) {
          await prisma.attendance.update({ where: { id: existing.id }, data: { status: "host", guestName: existing.guestName ?? name, ...(existing.checkedInAt ? {} : checkin) } });
        } else {
          await prisma.attendance.create({ data: { lumaEventId, guestEmail: email, guestName: name, status: "host", ...checkin } });
        }
      }
      synced += 1;
    }
  } catch (e) {
    console.warn("[attendance] host sync failed", e);
  }

  const hostRows = await prisma.attendance.findMany({ where: { lumaEventId, status: "host" }, select: { userId: true, guestEmail: true } });
  const hostUserIds = new Set(hostRows.map((r) => r.userId).filter(Boolean));
  const hostEmails = new Set(hostRows.map((r) => r.guestEmail).filter(Boolean));

  const guests = await listGuests(lumaEventId);
  for (const g of guests) {
    const email = (g.user_email || g.email || "").toLowerCase().trim();
    const status = g.approval_status === "approved" ? "going" : g.approval_status || "going";
    const lumaGuestId = g.api_id || g.guest_id || g.id || null;
    const answers = (g.registration_answers as Prisma.InputJsonValue) ?? undefined;
    const name = guestName(g);

    const user = email ? await findUserByEmail(email) : null;
    if (user) {
      const isHost = hostUserIds.has(user.id);
      await prisma.attendance.upsert({
        where: { userId_lumaEventId: { userId: user.id, lumaEventId } },
        create: { userId: user.id, lumaEventId, status, lumaGuestId, registrationAnswers: answers },
        update: { ...(isHost ? {} : { status }), lumaGuestId, registrationAnswers: answers },
      });
      synced += 1;
      continue;
    }
    if (!email) continue;
    if (hostEmails.has(email)) continue; // already a host row
    const existing = await prisma.attendance.findFirst({ where: { lumaEventId, guestEmail: email } });
    if (existing) {
      await prisma.attendance.update({
        where: { id: existing.id },
        data: { status, lumaGuestId, registrationAnswers: answers, guestName: name ?? existing.guestName },
      });
    } else {
      await prisma.attendance.create({
        data: { lumaEventId, guestEmail: email, guestName: name, status, lumaGuestId, registrationAnswers: answers },
      });
    }
    synced += 1;
  }
  return { synced, skipped: false as const };
}

/** Every email we know for a member: login, contact, and the one they use on Luma. */
async function userEmails(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, profile: { select: { contactEmail: true } }, lumaLink: { select: { lumaGuestEmail: true } } },
  });
  return [...new Set([u?.email, u?.profile?.contactEmail, u?.lumaLink?.lumaGuestEmail].filter((x): x is string => !!x).map((x) => x.toLowerCase()))];
}

/**
 * Take over attendance rows a host or Luma recorded under any of the member's
 * emails. Runs at sign-up and whenever the member opens their people pages.
 */
export async function claimGuestAttendance(userId: string, email?: string) {
  const emails = email ? [email.toLowerCase()] : await userEmails(userId);
  if (emails.length === 0) return;
  const rows = await prisma.attendance.findMany({ where: { userId: null, guestEmail: { in: emails } } });
  for (const g of rows) {
    const mine = await prisma.attendance.findUnique({
      where: { userId_lumaEventId: { userId, lumaEventId: g.lumaEventId } },
    });
    if (!mine) {
      await prisma.attendance.update({ where: { id: g.id }, data: { userId, guestEmail: null, guestName: null } });
      continue;
    }
    // Merge into the member's own row for that Sunday.
    const meetings = await prisma.meeting.findMany({ where: { OR: [{ aId: g.id }, { bId: g.id }] } });
    for (const m of meetings) {
      const other = m.aId === g.id ? m.bId : m.aId;
      const [aId, bId] = [mine.id, other].sort();
      try {
        await prisma.meeting.update({ where: { id: m.id }, data: { aId, bId } });
      } catch {
        await prisma.meeting.delete({ where: { id: m.id } }); // already recorded on the member's row
      }
    }
    if (!mine.checkedInAt && g.checkedInAt) {
      await prisma.attendance.update({ where: { id: mine.id }, data: { checkedInAt: g.checkedInAt, checkedInBy: g.checkedInBy } });
    }
    await prisma.attendance.delete({ where: { id: g.id } });
  }
}

// ─── Door list ───────────────────────────────────────────────────────────────

export async function loadCheckinList(lumaEventId: string): Promise<AttendeeView[]> {
  const event = await prisma.eventCache.findUnique({ where: { lumaEventId } });
  if (!event) return [];
  const rows = await prisma.attendance.findMany({
    where: { lumaEventId, status: { notIn: ["declined", "invited"] } },
    include: { user: userSelect },
  });

  const userIds = rows.map((r) => r.userId).filter((x): x is string => !!x);
  const emails = rows.map((r) => r.guestEmail).filter((x): x is string => !!x);
  const prior = await prisma.attendance.findMany({
    where: {
      lumaEventId: { not: lumaEventId },
      event: { startAt: { lt: event.startAt } },
      OR: [
        { userId: { in: userIds }, OR: [{ checkedInAt: { not: null } }, { status: "going" }] },
        { guestEmail: { in: emails }, OR: [{ checkedInAt: { not: null } }, { status: "going" }] },
      ],
    },
    select: { userId: true, guestEmail: true },
  });
  const seenUsers = new Set(prior.map((p) => p.userId).filter(Boolean));
  const seenEmails = new Set(prior.map((p) => p.guestEmail).filter(Boolean));

  return rows
    .map((r) => toView(r, !(r.userId ? seenUsers.has(r.userId) : r.guestEmail ? seenEmails.has(r.guestEmail) : false)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function setCheckedIn(attendanceId: string, on: boolean, byUserId: string) {
  return prisma.attendance.update({
    where: { id: attendanceId },
    data: on ? { checkedInAt: new Date(), checkedInBy: byUserId } : { checkedInAt: null, checkedInBy: null },
  });
}

export async function addWalkIn(params: { lumaEventId: string; name: string; email?: string | null; byUserId: string }) {
  const name = params.name.trim();
  if (!name) throw new Error("Name is required");
  const email = params.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email, or leave it blank");
  const now = new Date();

  const user = email ? await findUserByEmail(email) : null;
  if (user) {
    return prisma.attendance.upsert({
      where: { userId_lumaEventId: { userId: user.id, lumaEventId: params.lumaEventId } },
      create: { userId: user.id, lumaEventId: params.lumaEventId, status: "walkin", checkedInAt: now, checkedInBy: params.byUserId },
      update: { checkedInAt: now, checkedInBy: params.byUserId },
    });
  }
  if (email) {
    const existing = await prisma.attendance.findFirst({ where: { lumaEventId: params.lumaEventId, guestEmail: email } });
    if (existing) {
      return prisma.attendance.update({ where: { id: existing.id }, data: { checkedInAt: now, checkedInBy: params.byUserId, guestName: existing.guestName ?? name } });
    }
  }
  return prisma.attendance.create({
    data: { lumaEventId: params.lumaEventId, guestName: name, guestEmail: email, status: "walkin", checkedInAt: now, checkedInBy: params.byUserId },
  });
}

/** Events a host might be checking people into: the next one, plus the last few. */
export async function checkinEventChoices() {
  const now = Date.now();
  return prisma.eventCache.findMany({
    where: { status: "active", startAt: { gte: new Date(now - 45 * 24 * 3600 * 1000), lte: new Date(now + 10 * 24 * 3600 * 1000) } },
    orderBy: { startAt: "desc" },
    take: 6,
    select: { lumaEventId: true, title: true, startAt: true },
  });
}

// ─── "I met…" ────────────────────────────────────────────────────────────────

export async function myAttendance(userId: string, lumaEventId: string) {
  const mine = await prisma.attendance.findUnique({ where: { userId_lumaEventId: { userId, lumaEventId } } });
  if (mine) return mine;
  // Maybe the door list or Luma has them under another of their emails.
  await claimGuestAttendance(userId);
  return prisma.attendance.findUnique({ where: { userId_lumaEventId: { userId, lumaEventId } } });
}

/** Is this Sunday happening right now (an hour before start to eight hours after)? */
export function isLive(startAt: Date, now = Date.now()) {
  const t = startAt.getTime();
  return now >= t - 3600 * 1000 && now <= t + 8 * 3600 * 1000;
}

/**
 * Sundays this member can mark people for: any Sunday a host checked them in
 * (including one happening right now), plus past ones they RSVP'd to.
 */
export async function recentAttendedEvents(userId: string, days = 10) {
  await claimGuestAttendance(userId);
  const now = Date.now();
  const since = new Date(now - days * 24 * 3600 * 1000);
  const rows = await prisma.attendance.findMany({
    where: {
      userId,
      OR: [
        { checkedInAt: { not: null }, event: { status: "active", startAt: { gte: since } } },
        { status: { in: ["going", "walkin"] }, event: { status: "active", startAt: { gte: since, lte: new Date(now - 2 * 3600 * 1000) } } },
      ],
    },
    include: { event: { select: { lumaEventId: true, title: true, startAt: true } }, _count: { select: { meetingsA: true, meetingsB: true } } },
    orderBy: { event: { startAt: "desc" } },
  });
  return rows.map((r) => ({
    lumaEventId: r.event.lumaEventId,
    title: r.event.title,
    startAt: r.event.startAt.toISOString(),
    live: isLive(r.event.startAt, now),
    checkedIn: !!r.checkedInAt,
    metCount: r._count.meetingsA + r._count.meetingsB,
  }));
}

export type MetPerson = AttendeeView & { met: boolean; note: string | null };

export async function loadMetPicker(userId: string, lumaEventId: string): Promise<{ me: { id: string } | null; people: MetPerson[]; anyCheckins: boolean }> {
  const me = await myAttendance(userId, lumaEventId);
  if (!me) return { me: null, people: [], anyCheckins: false };
  const rows = await prisma.attendance.findMany({
    where: { lumaEventId, id: { not: me.id }, status: { notIn: ["declined", "invited"] } },
    include: { user: userSelect },
  });
  const anyCheckins = rows.some((r) => r.checkedInAt) || !!me.checkedInAt;
  const inRoom = anyCheckins ? rows.filter((r) => r.checkedInAt) : rows;
  const meetings = await prisma.meeting.findMany({ where: { lumaEventId, OR: [{ aId: me.id }, { bId: me.id }] } });
  const mine = new Map<string, string | null>();
  for (const m of meetings) {
    const other = m.aId === me.id ? m.bId : m.aId;
    mine.set(other, m.aId === me.id ? m.noteA : m.noteB);
  }
  const people = inRoom
    .map((r) => ({ ...toView(r, false), met: mine.has(r.id), note: mine.get(r.id) ?? null }))
    .sort((a, b) => Number(b.met) - Number(a.met) || a.name.localeCompare(b.name));
  return { me: { id: me.id }, people, anyCheckins };
}

/** Save what you talked about. Marks the person as met if they weren't already. */
export async function saveMeetingNote(userId: string, lumaEventId: string, otherAttendanceId: string, note: string) {
  const me = await myAttendance(userId, lumaEventId);
  if (!me) throw new Error("You weren't on the list for that Sunday");
  const other = await prisma.attendance.findUnique({ where: { id: otherAttendanceId } });
  if (!other || other.lumaEventId !== lumaEventId || other.id === me.id) throw new Error("That person wasn't at this Sunday");
  const [aId, bId] = [me.id, other.id].sort();
  const text = note.trim().slice(0, 500) || null;
  const side = me.id === aId ? { noteA: text } : { noteB: text };
  await prisma.meeting.upsert({
    where: { lumaEventId_aId_bId: { lumaEventId, aId, bId } },
    create: { lumaEventId, aId, bId, recordedByUserId: userId, ...side },
    update: side,
  });
}

export async function toggleMeeting(userId: string, lumaEventId: string, otherAttendanceId: string, on: boolean) {
  const me = await myAttendance(userId, lumaEventId);
  if (!me) throw new Error("You weren't on the list for that Sunday");
  const other = await prisma.attendance.findUnique({ where: { id: otherAttendanceId } });
  if (!other || other.lumaEventId !== lumaEventId || other.id === me.id) throw new Error("That person wasn't at this Sunday");
  const [aId, bId] = [me.id, other.id].sort();
  if (on) {
    await prisma.meeting.upsert({
      where: { lumaEventId_aId_bId: { lumaEventId, aId, bId } },
      create: { lumaEventId, aId, bId, recordedByUserId: userId },
      update: {},
    });
  } else {
    await prisma.meeting.deleteMany({ where: { lumaEventId, aId, bId } });
  }
}

// ─── Met graph ───────────────────────────────────────────────────────────────

export type GraphNode = { id: string; name: string; firstName: string; avatarUrl: string | null; me: boolean; times: number; note: string | null };
export type GraphEdge = { a: string; b: string; times: number };

/** The member at the centre, everyone they've marked as met, and links among those people. */
export async function loadMetGraph(userId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const mine = await prisma.attendance.findMany({ where: { userId }, select: { id: true } });
  const myIds = mine.map((m) => m.id);
  if (myIds.length === 0) return { nodes: [], edges: [] };

  const meetings = await prisma.meeting.findMany({
    where: { OR: [{ aId: { in: myIds } }, { bId: { in: myIds } }] },
    include: { a: { include: { user: userSelect } }, b: { include: { user: userSelect } } },
  });
  if (meetings.length === 0) return { nodes: [], edges: [] };

  const meUser = await prisma.user.findUnique({ where: { id: userId }, ...userSelect });
  const meRow: AttRow = { id: "me", userId, guestName: null, guestEmail: null, status: "", checkedInAt: null, user: meUser };
  const meName = attendeeName(meRow);
  const nodes = new Map<string, GraphNode>([["me", { id: "me", name: meName, firstName: meName.split(/\s+/)[0], avatarUrl: meUser?.profile?.avatarUrl ?? null, me: true, times: 0, note: null }]]);
  const edges = new Map<string, GraphEdge>();
  const keyOfAtt = new Map<string, string>();

  const bump = (a: string, b: string) => {
    const [x, y] = [a, b].sort();
    const k = `${x}|${y}`;
    const e = edges.get(k) ?? { a: x, b: y, times: 0 };
    e.times += 1;
    edges.set(k, e);
  };

  const sorted = [...meetings].sort((x, y) => x.updatedAt.getTime() - y.updatedAt.getTime());
  for (const m of sorted) {
    const iAmA = myIds.includes(m.aId);
    const other = iAmA ? m.b : m.a;
    const myNote = iAmA ? m.noteA : m.noteB;
    const key = personKey(other);
    keyOfAtt.set(other.id, key);
    const name = attendeeName(other);
    const n = nodes.get(key) ?? { id: key, name, firstName: name.split(/\s+/)[0], avatarUrl: other.user?.profile?.avatarUrl ?? null, me: false, times: 0, note: null };
    n.times += 1;
    if (myNote) n.note = myNote; // most recent note wins
    nodes.set(key, n);
    bump("me", key);
  }

  // Links among the people I've met: every attendance of theirs, then meetings between any two of them.
  const otherUserIds = [...nodes.values()].filter((n) => n.id.startsWith("u:")).map((n) => n.id.slice(2));
  const otherEmails = [...nodes.values()].filter((n) => n.id.startsWith("g:")).map((n) => n.id.slice(2));
  const theirAtts = await prisma.attendance.findMany({
    where: { OR: [{ userId: { in: otherUserIds } }, { guestEmail: { in: otherEmails } }] },
    select: { id: true, userId: true, guestEmail: true },
  });
  for (const t of theirAtts) keyOfAtt.set(t.id, t.userId ? `u:${t.userId}` : `g:${t.guestEmail}`);
  const theirIds = theirAtts.map((t) => t.id);
  if (theirIds.length > 1) {
    const among = await prisma.meeting.findMany({ where: { aId: { in: theirIds }, bId: { in: theirIds } }, select: { aId: true, bId: true } });
    for (const m of among) {
      const ka = keyOfAtt.get(m.aId);
      const kb = keyOfAtt.get(m.bId);
      if (ka && kb && ka !== kb && nodes.has(ka) && nodes.has(kb)) bump(ka, kb);
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/** People this member has marked as met, most recent first, for the profile list. */
export async function loadMetList(userId: string) {
  const { nodes } = await loadMetGraph(userId);
  return nodes.filter((n) => !n.me).sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
}
