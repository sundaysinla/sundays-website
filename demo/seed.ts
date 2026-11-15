/**
 * Seeds the live-demo database: a fictional cast across five Sundays, with
 * today's event live (people checked in at the door, cars confirmed, an Uber
 * group, chats) and a met-graph behind the member we present as.
 *
 * Nothing here is real except the venue and the Luma id the RSVP page embeds
 * (both from the Sep 27 event). Every person is made up; phones sit in
 * 555-01xx and emails on example.com, so nothing can reach anyone even if a
 * key leaks in.
 *
 * Run: npm run demo:seed   (re-run any time to reset the demo)
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { haversineKm, optimizeOrder, routeKm, type Pt } from "../lib/carpool/route.ts";
import { defaultMeetAt, hubById } from "../lib/carpool/rideshare.ts";
import { demoEnv } from "./env.ts";

const url = process.env.DEMO_DATABASE_URL ?? demoEnv.DATABASE_URL ?? "";

// ── guard ───────────────────────────────────────────────────────────────────
// The portal's own DATABASE_URL is Neon, which doubles as production. This
// script deletes everything before seeding, so it only ever runs locally.
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error(`Refusing to seed a non-local database.\n  got: ${url.replace(/:[^:@]*@/, ":***@") || "(nothing)"}`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ── today's event ───────────────────────────────────────────────────────────
// Check-in, "I met" and the carpool board only show a Sunday that's under way,
// so by default the demo Sunday started a little over an hour before you seed
// (the panel's Reset re-seeds, which moves it up again). DEMO_START pins it to
// an ISO time instead. The Luma id is the real Sep 27 event, so the RSVP page
// embeds an actual Luma page.
function demoStart() {
  if (process.env.DEMO_START) return new Date(process.env.DEMO_START);
  const quarter = 15 * MIN;
  return new Date(Math.floor((Date.now() - 75 * MIN) / quarter) * quarter);
}
const startAt = demoStart();
const TODAY = {
  lumaEventId: "evt-nN4VHhOXqyzxXMA",
  title: `sundays in la: ${startAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).toLowerCase()}`,
  startAt,
  address: "2525 W Washington Blvd, Los Angeles, CA 90018, USA",
  lat: 34.04025,
  lng: -118.3186165,
  lumaUrl: "https://luma.com/yibo150e",
};
const venue: Pt = { lat: TODAY.lat, lng: TODAY.lng };

const WATT = { address: "Watt Hall, Los Angeles, CA 90089, USA", lat: 34.0191266, lng: -118.2879657 };
const BROAD = { address: "Broad Art Center, 240 Charles E Young Dr N, Los Angeles, CA 90095, USA", lat: 34.0763, lng: -118.4411 };

function pastSunday(weeksAgo: number) {
  const startAt = new Date(TODAY.startAt.getTime() - weeksAgo * 7 * DAY);
  const day = startAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).toLowerCase();
  return { startAt, day };
}

const PAST = [
  { key: "aug30", weeks: 4, campus: "ucla", venue: BROAD },
  { key: "sep06", weeks: 3, campus: "usc", venue: WATT },
  { key: "sep13", weeks: 2, campus: "usc", venue: WATT },
  { key: "sep20", weeks: 1, campus: "ucla", venue: BROAD },
].map((e) => {
  const { startAt, day } = pastSunday(e.weeks);
  return { ...e, lumaEventId: `evt-demo-${e.key}`, title: `sundays @ ${e.campus}: ${day}`, startAt };
});

// ── the cast ────────────────────────────────────────────────────────────────
// `account` people have a portal login; the rest only exist as Luma RSVPs and
// host write-ins, which is how most of a real guest list looks.

type Person = {
  key: string;
  name: string;
  school: "USC" | "UCLA" | "other";
  account?: boolean;
  avatar?: boolean;
  phone?: string;
  bio?: string;
  portfolio?: string;
  workingOn: string;
  home?: { address: string; neighborhood: string; lat: number; lng: number };
};

const P: Person[] = [
  // the three personas we present as, plus the host
  {
    key: "jordan", name: "Jordan Chen", school: "USC", account: true, avatar: true, phone: "+12135550109",
    bio: "Design + CS at USC. Building a type specimen site for a variable serif, and a tiny synth that runs in the browser.",
    portfolio: "https://jordanchen.example", workingOn: "variable serif type specimen",
    home: { address: "3450 W 6th St, Los Angeles, CA 90020", neighborhood: "Koreatown", lat: 34.0629, lng: -118.2969 },
  },
  {
    key: "maya", name: "Maya Okonkwo", school: "UCLA", account: true, avatar: true, phone: "+13105550118",
    bio: "DMA at UCLA. Generative textile patterns in p5.js, printed on actual fabric.",
    workingOn: "generative textile prints",
    home: { address: "3500 Overland Ave, Los Angeles, CA 90034", neighborhood: "Palms", lat: 34.0286, lng: -118.4048 },
  },
  {
    key: "lena", name: "Lena Park", school: "USC", account: true, avatar: true, phone: "+12135550147",
    bio: "Iovine and Young. Making a zine about LA bus stops.",
    workingOn: "bus stop zine, issue 2",
    home: { address: "1150 W 29th St, Los Angeles, CA 90007", neighborhood: "North University Park", lat: 34.0276, lng: -118.2826 },
  },
  { key: "richard", name: "Richard Zhang", school: "USC", account: true, workingOn: "the membership portal" },

  // drivers
  {
    key: "devin", name: "Devin Ruiz", school: "USC", account: true, phone: "+12135550142",
    bio: "Games at USC. Pixel-art roguelike in Godot.", workingOn: "godot roguelike, boss fight",
    home: { address: "1526 Sunset Blvd, Los Angeles, CA 90026", neighborhood: "Echo Park", lat: 34.0781, lng: -118.2606 },
  },
  {
    key: "priya", name: "Priya Raghunathan", school: "UCLA", account: true, avatar: true, phone: "+14245550176",
    bio: "Bioengineering, but mostly here for the ceramics.", workingOn: "glaze chemistry notebook",
    home: { address: "1073 Broxton Ave, Los Angeles, CA 90024", neighborhood: "Westwood", lat: 34.0614, lng: -118.4456 },
  },

  // riders in confirmed cars
  { key: "sana", name: "Sana Kapoor", school: "USC", account: true, avatar: true, phone: "+13235550164", bio: "Starting a risograph co-op for student zines.", workingOn: "riso co-op pricing sheet", home: { address: "2810 Sunset Blvd, Los Angeles, CA 90026", neighborhood: "Silver Lake", lat: 34.0781, lng: -118.2748 } },
  { key: "wesley", name: "Wesley Tran", school: "USC", phone: "+12135550188", workingOn: "short film, rough cut", home: { address: "1625 W Temple St, Los Angeles, CA 90026", neighborhood: "Historic Filipinotown", lat: 34.0687, lng: -118.2681 } },
  { key: "gabriel", name: "Gabriel Iniesta", school: "UCLA", phone: "+13105550127", workingOn: "climbing gym route-setting app", home: { address: "3600 Motor Ave, Los Angeles, CA 90034", neighborhood: "Palms", lat: 34.0257, lng: -118.4008 } },
  { key: "alina", name: "Alina Voss", school: "UCLA", phone: "+13105550133", workingOn: "film photo scans", home: { address: "9300 Culver Blvd, Culver City, CA 90232", neighborhood: "Culver City", lat: 34.0227, lng: -118.3965 } },
  { key: "theo", name: "Theo Marchetti", school: "UCLA", account: true, phone: "+13105550151", bio: "Graphic design. Always has a portfolio crit going.", workingOn: "portfolio crit", home: { address: "12420 Venice Blvd, Los Angeles, CA 90066", neighborhood: "Mar Vista", lat: 34.0007, lng: -118.4386 } },

  // Priya's car, suggested by the matcher but not confirmed yet
  { key: "hana", name: "Hana Sato", school: "UCLA", account: true, avatar: true, phone: "+14245550102", bio: "Risograph and bookbinding.", workingOn: "riso prints for a friend's album", home: { address: "2130 Sawtelle Blvd, Los Angeles, CA 90025", neighborhood: "Sawtelle", lat: 34.0417, lng: -118.4453 } },
  { key: "noor", name: "Noor Haddad", school: "UCLA", account: true, phone: "+13105550171", bio: "Pre-law. Secretly draws fonts.", workingOn: "an arabic display font", home: { address: "1930 Century Park W, Los Angeles, CA 90067", neighborhood: "Century City", lat: 34.0575, lng: -118.417 } },

  // the USC Village Uber (confirmed, Lena orders)
  { key: "kofi", name: "Kofi Mensah", school: "USC", account: true, avatar: true, phone: "+12135550193", bio: "Robotics club. Needs a UI person for the rover dashboard.", workingOn: "rover telemetry dashboard", home: { address: "3131 McClintock Ave, Los Angeles, CA 90007", neighborhood: "University Park", lat: 34.024, lng: -118.288 } },
  { key: "ari", name: "Ari Feldman", school: "USC", phone: "+12135550124", workingOn: "podcast about LA diners", home: { address: "2715 Portland St, Los Angeles, CA 90007", neighborhood: "North University Park", lat: 34.0294, lng: -118.2807 } },
  { key: "dani", name: "Dani Ortiz", school: "USC", phone: "+12135550166", workingOn: "cyanotype series", home: { address: "1020 W Jefferson Blvd, Los Angeles, CA 90007", neighborhood: "University Park", lat: 34.0254, lng: -118.2851 } },

  // still need a ride — what "Suggest placements" and "Uber the rest" act on live
  { key: "tomas", name: "Tomás Reyes", school: "UCLA", phone: "+13105550138", workingOn: "mechanical keyboard PCB", home: { address: "250 De Neve Dr, Los Angeles, CA 90024", neighborhood: "Westwood", lat: 34.073, lng: -118.4526 } },
  { key: "isla", name: "Isla Novak", school: "UCLA", phone: "+14245550181", workingOn: "choreography notation app", home: { address: "10950 Strathmore Dr, Los Angeles, CA 90024", neighborhood: "Westwood", lat: 34.0676, lng: -118.4464 } },
  { key: "sam", name: "Sam Whitfield", school: "UCLA", phone: "+13105550159", workingOn: "thrifted-furniture restoration log", home: { address: "515 Gayley Ave, Los Angeles, CA 90024", neighborhood: "Westwood", lat: 34.068, lng: -118.45 } },
  { key: "ada", name: "Ada Brennan", school: "UCLA", phone: "+14245550113", workingOn: "sound walk of Westwood", home: { address: "351 Charles E Young Dr W, Los Angeles, CA 90095", neighborhood: "Westwood", lat: 34.0706, lng: -118.4508 } },

  // no carpool, just coming
  { key: "mira", name: "Mira Castellanos", school: "USC", account: true, avatar: true, bio: "Architecture. Paper models of buildings that were never built.", workingOn: "paper model of an unbuilt LA tower" },
  { key: "june", name: "June Adebayo", school: "USC", account: true, workingOn: "a cookbook for dorm kitchens" },
  { key: "felix", name: "Felix Huang", school: "UCLA", account: true, avatar: true, workingOn: "open-source bus arrival widget" },
  { key: "rohan", name: "Rohan Mehta", school: "USC", account: true, workingOn: "startup landing page, v3" },
  { key: "chloe", name: "Chloe Nakamura", school: "UCLA", workingOn: "animated short, storyboards" },
  { key: "ezra", name: "Ezra Lindqvist", school: "UCLA", workingOn: "modular synth panel" },
  { key: "olivia", name: "Olivia Brandt", school: "other", workingOn: "grant application for a mural" },
  { key: "ben", name: "Ben Oduya", school: "USC", workingOn: "sneaker customization" },
  { key: "zoe", name: "Zoe Albright", school: "UCLA", workingOn: "tarot deck illustrations" },
  { key: "luca", name: "Luca Ferraro", school: "other", workingOn: "espresso cart business plan" },
  { key: "marcus", name: "Marcus Ellery", school: "USC", workingOn: "beat tape" },
];

const byKey = new Map(P.map((p) => [p.key, p]));
const who = (k: string) => {
  const p = byKey.get(k);
  if (!p) throw new Error(`no cast member "${k}"`);
  return p;
};
const slug = (p: Person) => p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".");
const emailOf = (p: Person) => (p.key === "richard" ? "host@sundays.example" : `${slug(p)}@example.com`);
const userIdOf = (p: Person) => `demo-${p.key}`;

// ── avatars ─────────────────────────────────────────────────────────────────
// Abstract shapes in the brand palette, not faces: served from /api/avatar
// exactly like an uploaded photo.
const PALETTE = ["#3600CF", "#C3B3F1", "#CBFF36", "#010101", "#FCFAF7"];
function avatarSvg(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const pick = (n: number) => PALETTE[(h >>> n) % PALETTE.length];
  const bg = pick(0);
  let fg = pick(5);
  if (fg === bg) fg = PALETTE[(PALETTE.indexOf(bg) + 2) % PALETTE.length];
  let acc = pick(11);
  if (acc === bg || acc === fg) acc = PALETTE[(PALETTE.indexOf(fg) + 1) % PALETTE.length];
  const cx = 30 + ((h >>> 3) % 40);
  const cy = 34 + ((h >>> 7) % 34);
  const r = 26 + ((h >>> 13) % 16);
  const rot = (h >>> 17) % 90;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="${bg}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fg}"/><rect x="40" y="50" width="60" height="22" fill="${acc}" transform="rotate(${rot} 48 48)"/></svg>`;
}

// ── attendance plan ─────────────────────────────────────────────────────────

const pastAttendees: Record<string, string[]> = {
  aug30: ["maya", "priya", "hana", "noor", "theo", "felix", "chloe", "zoe", "ezra", "gabriel"],
  sep06: ["jordan", "maya", "theo", "priya", "hana", "kofi", "mira", "june", "rohan", "ben"],
  sep13: ["jordan", "maya", "sana", "kofi", "priya", "devin", "lena", "mira", "rohan", "wesley", "ari", "june"],
  sep20: ["jordan", "sana", "hana", "devin", "noor", "priya", "maya", "felix", "chloe", "tomas", "isla", "lena"],
};

// Today: minutes after the doors opened that each person was checked in.
// `null` = RSVP'd but not here yet, so there's someone to check in live.
const todayCheckins: Record<string, number | null> = {
  richard: -20, jordan: 11, devin: 11, sana: 11, wesley: 11,
  maya: 18, gabriel: 18, alina: 18, theo: 18,
  lena: 9, kofi: 9, ari: 9, dani: 9,
  priya: 26, hana: 26, noor: 26,
  mira: 4, june: 32, felix: 22, rohan: 41, chloe: 22, ezra: 35,
  olivia: null, ben: null, zoe: null, luca: null,
  marcus: null, tomas: null, isla: null, sam: null, ada: null,
};
const walkIns = [
  { name: "Ines Moreau", email: null as string | null, minutes: 47 },
  { name: "Pat Morales", email: "pat.morales@example.com", minutes: 58 },
];

// Who met whom, per Sunday. Notes are Jordan's (or whoever is listed first),
// private to them. The most recent note per person is what the profile shows.
const meetings: { ev: string; a: string; b: string; note?: string; noteB?: string }[] = [
  { ev: "sep06", a: "jordan", b: "maya", note: "generative textiles in p5, wants sound for her gallery piece", noteB: "jordan makes a browser synth!! ask about the show" },
  { ev: "sep06", a: "jordan", b: "theo", note: "portfolio crit swap, he's applying to studios in NY" },
  { ev: "sep06", a: "maya", b: "priya" },
  { ev: "sep06", a: "theo", b: "hana" },
  { ev: "sep06", a: "kofi", b: "mira" },
  { ev: "sep13", a: "jordan", b: "maya", note: "sent her the webaudio repo, she's sending fabric swatches", noteB: "got the repo, try it on the textile piece" },
  { ev: "sep13", a: "jordan", b: "sana", note: "starting a riso co-op for student zines" },
  { ev: "sep13", a: "jordan", b: "kofi", note: "robotics club needs a UI person for their rover dashboard" },
  { ev: "sep13", a: "jordan", b: "priya" },
  { ev: "sep13", a: "sana", b: "devin" },
  { ev: "sep13", a: "kofi", b: "priya" },
  { ev: "sep13", a: "lena", b: "kofi" },
  { ev: "sep13", a: "lena", b: "sana", note: "co-op could print the bus stop zine" },
  { ev: "sep20", a: "jordan", b: "sana", note: "co-op launching in october, i'll design the logo" },
  { ev: "sep20", a: "jordan", b: "hana", note: "offered to riso-print the type specimen" },
  { ev: "sep20", a: "jordan", b: "devin", note: "pixel-art roguelike in godot, wants a chiptune" },
  { ev: "sep20", a: "jordan", b: "noor", note: "pre-law but draws arabic display type?! intro to my type prof" },
  { ev: "sep20", a: "sana", b: "hana" },
  { ev: "sep20", a: "noor", b: "priya" },
  { ev: "sep20", a: "maya", b: "priya" },
  { ev: "today", a: "jordan", b: "devin", note: "drove me in, playtested the boss fight in the car" },
  { ev: "today", a: "jordan", b: "wesley", note: "short film needs a composer — send him the synth" },
  { ev: "today", a: "devin", b: "wesley" },
  { ev: "today", a: "lena", b: "kofi" },
];

// ── carpool plan for today ──────────────────────────────────────────────────

type CarPlan =
  | { kind: "drive"; driver: string; seats: number; riders: string[]; confirmed: boolean; notes?: string; byHost?: boolean }
  | { kind: "rideshare"; hub: string; booker: string; riders: string[]; confirmed: boolean };

const cars: CarPlan[] = [
  { kind: "drive", driver: "devin", seats: 3, riders: ["sana", "wesley", "jordan"], confirmed: true, notes: "Can swing through Silver Lake" },
  { kind: "drive", driver: "maya", seats: 3, riders: ["gabriel", "alina", "theo"], confirmed: true, notes: "Leaving Palms around 1:15, room for a bike" },
  // Hana and Noor were placed by hand, so "Suggest placements" leaves them be and
  // only fills the last seat (Isla); Tomás, Sam and Ada then make one De Neve Uber.
  { kind: "drive", driver: "priya", seats: 3, riders: ["hana", "noor"], confirmed: false, byHost: true, notes: "Coming from UCLA, happy to detour" },
  { kind: "rideshare", hub: "usc", booker: "lena", riders: ["lena", "kofi", "ari", "dani"], confirmed: true },
];
const waiting = ["tomas", "isla", "sam", "ada"];
const riderNotes: Record<string, string> = {
  theo: "Bringing a portfolio crit, sorry in advance",
  tomas: "Signed up late, sorry!",
  ada: "Can bring the extension cords",
};

const chats: Record<string, { from: string | "host"; at: number; body: string }[]> = {
  devin: [
    { from: "devin", at: -58, body: "leaving echo park at 1:15. i'll text when i'm 5 min out" },
    { from: "sana", at: -55, body: "i'll be out front of the coffee place on the corner" },
    { from: "jordan", at: -52, body: "perfect, i'm at the 6th st entrance. grey hoodie" },
    { from: "wesley", at: -41, body: "running 2 min late sorry!!" },
    { from: "host", at: -30, body: "thanks for driving devin. parking is in the back lot off Washington" },
  ],
  maya: [
    { from: "maya", at: -70, body: "hi all! theo first, then gabriel, then alina. bike rack is on" },
    { from: "theo", at: -66, body: "legend" },
  ],
  usc: [
    { from: "lena", at: -40, body: "i'll order at 1:35, meet on the Hoover St side of the Village" },
    { from: "kofi", at: -37, body: "omw, 5 min" },
    { from: "host", at: -34, body: "keep the receipt, we reimburse groups of 4" },
  ],
};

// ── seed ────────────────────────────────────────────────────────────────────

async function wipe() {
  // Children first; cascades would do it, but this reads better in a log.
  await prisma.meeting.deleteMany({});
  await prisma.carMessage.deleteMany({});
  await prisma.carStop.deleteMany({});
  await prisma.car.deleteMany({});
  await prisma.carpoolOffer.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.demoHistory.deleteMany({});
  await prisma.eventCache.deleteMany({});
  await prisma.lumaLink.deleteMany({});
  await prisma.profile.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
}

export async function runSeed() {
  const now = Date.now();
  await wipe();

  // Events
  const questions = [
    { id: "vcylbu79", label: "school", options: ["UCLA", "USC", "other"], multiple: true, required: true, question_type: "select" },
    { id: "w0lnkek2", label: "what are you working on? (please no HW or studying for midterms :) )", required: true, question_type: "text" },
    { id: "ysvcdhe1", label: "looking for a ride?", options: ["yes", "no"], required: true, question_type: "select" },
  ];
  await prisma.eventCache.create({
    data: {
      lumaEventId: TODAY.lumaEventId, title: TODAY.title, startAt: TODAY.startAt,
      endAt: new Date(TODAY.startAt.getTime() + 4 * HOUR), timezone: "America/Los_Angeles",
      address: TODAY.address, lat: TODAY.lat, lng: TODAY.lng, lumaUrl: TODAY.lumaUrl,
      registrationQuestions: questions, status: "active", lastSeenAt: new Date(),
    },
  });
  for (const e of PAST) {
    await prisma.eventCache.create({
      data: {
        lumaEventId: e.lumaEventId, title: e.title, startAt: e.startAt,
        endAt: new Date(e.startAt.getTime() + 4 * HOUR), timezone: "America/Los_Angeles",
        address: e.venue.address, lat: e.venue.lat, lng: e.venue.lng,
        lumaUrl: TODAY.lumaUrl, registrationQuestions: questions, status: "active", lastSeenAt: e.startAt,
      },
    });
  }
  const events: Record<string, { lumaEventId: string; startAt: Date }> = {
    today: TODAY,
    ...Object.fromEntries(PAST.map((e) => [e.key, e])),
  };

  // People
  for (const p of P.filter((p) => p.account)) {
    const id = userIdOf(p);
    const email = emailOf(p);
    const svg = p.avatar ? Buffer.from(avatarSvg(p.name)) : null;
    await prisma.user.create({
      data: {
        id, name: p.name, email, emailVerified: new Date(now - 30 * DAY),
        createdAt: new Date(now - 40 * DAY),
        profile: {
          create: {
            displayName: p.name, contactEmail: email, contactEmailVerified: true,
            bio: p.bio ?? null, portfolioUrl: p.portfolio ?? null, school: p.school,
            phone: p.phone ?? null,
            avatarData: svg, avatarMime: svg ? "image/svg+xml" : null,
            avatarUrl: svg ? `/api/avatar/${id}?v=1` : null,
          },
        },
        lumaLink: { create: { lumaGuestEmail: email, lastSyncedAt: new Date() } },
      },
    });
  }

  // Jordan's demos (what the RSVP form offers and the profile lists)
  const jordanDemos = [
    { title: "variable serif type specimen", notes: "Scroll-driven axes; weights 200–900.", ev: "sep20" },
    { title: "browser synth (WebAudio)", notes: "Four voices, a filter, and a sequencer you can share as a link.", ev: "sep13" },
    { title: "plant-watering discord bot", notes: null, ev: "sep06" },
  ];
  for (const d of jordanDemos) {
    await prisma.demoHistory.create({ data: { userId: userIdOf(who("jordan")), title: d.title, notes: d.notes, eventId: events[d.ev].lumaEventId, createdAt: events[d.ev].startAt } });
  }
  await prisma.demoHistory.create({ data: { userId: userIdOf(who("maya")), title: "generative textile prints", eventId: events.sep13.lumaEventId, createdAt: events.sep13.startAt } });
  await prisma.demoHistory.create({ data: { userId: userIdOf(who("lena")), title: "bus stop zine, issue 1", eventId: events.sep13.lumaEventId, createdAt: events.sep13.startAt } });

  // Attendance
  const att = new Map<string, string>(); // `${ev}:${key}` → attendance id
  const answers = (p: Person) => ({ school: p.school, working_on: p.workingOn });
  async function attend(ev: string, p: Person, status: string, checkedInAt: Date | null) {
    const ident = p.account ? { userId: userIdOf(p) } : { guestName: p.name, guestEmail: emailOf(p) };
    const row = await prisma.attendance.create({
      data: {
        ...ident, lumaEventId: events[ev].lumaEventId, status,
        registrationAnswers: answers(p), checkedInAt,
        checkedInBy: checkedInAt ? (status === "host" ? "luma-host" : userIdOf(who("richard"))) : null,
        createdAt: new Date(events[ev].startAt.getTime() - 3 * DAY),
      },
    });
    att.set(`${ev}:${p.key}`, row.id);
  }

  for (const e of PAST) {
    await attend(e.key, who("richard"), "host", e.startAt);
    for (const [i, k] of pastAttendees[e.key].entries()) {
      await attend(e.key, who(k), "going", new Date(e.startAt.getTime() + ((i * 7) % 50) * MIN));
    }
  }

  const doorsOpen = TODAY.startAt.getTime();
  const latest = now - 2 * MIN;
  for (const [k, minutes] of Object.entries(todayCheckins)) {
    const p = who(k);
    const at = minutes == null ? null : new Date(Math.min(doorsOpen + minutes * MIN, latest));
    await attend("today", p, k === "richard" ? "host" : "going", at);
  }
  for (const w of walkIns) {
    await prisma.attendance.create({
      data: {
        lumaEventId: TODAY.lumaEventId, guestName: w.name, guestEmail: w.email, status: "walkin",
        checkedInAt: new Date(Math.min(doorsOpen + w.minutes * MIN, latest)), checkedInBy: userIdOf(who("richard")),
      },
    });
  }
  // Someone who can't make it (hidden from the door list) and one on the waitlist.
  await prisma.attendance.create({ data: { lumaEventId: TODAY.lumaEventId, guestName: "Nico Alvarez", guestEmail: "nico.alvarez@example.com", status: "declined" } });
  await prisma.attendance.create({ data: { lumaEventId: TODAY.lumaEventId, guestName: "Remy Castillo", guestEmail: "remy.castillo@example.com", status: "waitlist" } });

  // Meetings
  for (const m of meetings) {
    const a = att.get(`${m.ev}:${m.a}`);
    const b = att.get(`${m.ev}:${m.b}`);
    if (!a || !b) throw new Error(`meeting ${m.a}–${m.b} at ${m.ev}: both need to be on that Sunday's list`);
    const [aId, bId] = [a, b].sort();
    const aIsFirst = aId === a;
    const at = new Date(Math.min(events[m.ev].startAt.getTime() + 90 * MIN, latest));
    await prisma.meeting.create({
      data: {
        lumaEventId: events[m.ev].lumaEventId, aId, bId,
        noteA: (aIsFirst ? m.note : m.noteB) ?? null,
        noteB: (aIsFirst ? m.noteB : m.note) ?? null,
        recordedByUserId: who(m.a).account ? userIdOf(who(m.a)) : null,
        createdAt: at, updatedAt: at,
      },
    });
  }

  // Carpool offers for today
  const offerId = new Map<string, string>();
  const signupAt = (i: number) => new Date(TODAY.startAt.getTime() - (4 * DAY - i * 3 * HOUR));
  let n = 0;
  async function offer(k: string, role: "driver" | "rider", seats?: number, notes?: string) {
    const p = who(k);
    if (!p.home) throw new Error(`${p.name} has no pickup address`);
    const ident = p.account
      ? { userId: userIdOf(p) }
      : { guestName: p.name, guestEmail: emailOf(p), guestPhone: p.phone ?? null };
    const row = await prisma.carpoolOffer.create({
      data: {
        ...ident, lumaEventId: TODAY.lumaEventId, role, status: "open",
        address: p.home.address, lat: p.home.lat, lng: p.home.lng, neighborhood: p.home.neighborhood,
        seatsTotal: role === "driver" ? seats ?? 3 : null, notes: notes ?? riderNotes[k] ?? null,
        createdAt: signupAt(n++),
      },
    });
    offerId.set(k, row.id);
    return row;
  }

  const confirmedAt = new Date(TODAY.startAt.getTime() - 20 * HOUR); // Saturday evening
  const carIds: Record<string, string> = {};
  for (const c of cars) {
    if (c.kind === "drive") await offer(c.driver, "driver", c.seats, c.notes);
    for (const r of c.riders) await offer(r, "rider");
  }
  for (const k of waiting) await offer(k, "rider");

  for (const c of cars) {
    const riders = c.riders.map((k) => ({ key: k, point: who(k).home! as Pt }));
    if (c.kind === "drive") {
      const start = who(c.driver).home! as Pt;
      const ordered = optimizeOrder(start, riders, venue);
      const car = await prisma.car.create({
        data: {
          lumaEventId: TODAY.lumaEventId, kind: "drive", driverOfferId: offerId.get(c.driver)!,
          seatsTotal: c.seats, directKm: haversineKm(start, venue),
          routeKm: routeKm(start, ordered.map((r) => r.point), venue),
          confirmedAt: c.confirmed ? confirmedAt : null,
        },
      });
      carIds[c.driver] = car.id;
      for (const [i, r] of ordered.entries()) {
        const without = ordered.filter((x) => x !== r).map((x) => x.point);
        const addedKm = routeKm(start, ordered.map((x) => x.point), venue) - routeKm(start, without, venue);
        await prisma.carStop.create({
          data: { carId: car.id, riderOfferId: offerId.get(r.key)!, order: i, source: c.byHost ? "host" : "matcher", addedKm, confirmedAt: c.confirmed ? confirmedAt : null },
        });
      }
    } else {
      const hub = hubById(c.hub)!;
      const car = await prisma.car.create({
        data: {
          lumaEventId: TODAY.lumaEventId, kind: "rideshare", hubId: hub.id,
          meetAt: defaultMeetAt(TODAY.startAt, hub, venue), bookerOfferId: offerId.get(c.booker)!,
          seatsTotal: 4, directKm: haversineKm(hub, venue), routeKm: haversineKm(hub, venue),
          confirmedAt: c.confirmed ? confirmedAt : null,
        },
      });
      carIds[c.hub] = car.id;
      for (const [i, k] of c.riders.entries()) {
        await prisma.carStop.create({
          data: { carId: car.id, riderOfferId: offerId.get(k)!, order: i, source: "matcher", confirmedAt: c.confirmed ? confirmedAt : null },
        });
      }
    }
  }

  // Car chats
  for (const [car, msgs] of Object.entries(chats)) {
    for (const m of msgs) {
      const host = m.from === "host";
      await prisma.carMessage.create({
        data: {
          carId: carIds[car], authorOfferId: host ? null : offerId.get(m.from)!,
          authorName: host ? "Richard Zhang" : who(m.from).name, body: m.body,
          createdAt: new Date(TODAY.startAt.getTime() + m.at * MIN),
        },
      });
    }
  }

  const here = Object.values(todayCheckins).filter((v) => v != null).length + walkIns.length;
  console.log(
    [
      `seeded "${TODAY.title}" (${TODAY.startAt.toISOString()}) + ${PAST.length} past Sundays`,
      `  ${P.length} people, ${P.filter((p) => p.account).length} with accounts`,
      `  door list: ${here} checked in, ${Object.values(todayCheckins).filter((v) => v == null).length} still to arrive, 1 waitlist`,
      `  carpool: 3 drivers, 1 Uber from USC Village, ${waiting.length} riders waiting`,
      `  ${meetings.length} meetings; Jordan has met ${new Set(meetings.filter((m) => m.a === "jordan").map((m) => m.b)).size} people`,
    ].join("\n")
  );
  const live = now >= TODAY.startAt.getTime() - HOUR && now <= TODAY.startAt.getTime() + 8 * HOUR;
  if (!live) console.warn(`  ! the demo Sunday isn't live right now, so check-in and "I met" read as past. Unset DEMO_START or move it.`);
}

/** True when no demo Sunday is under way with a few hours to spare, e.g. it was seeded on another day. */
export async function demoIsStale() {
  const now = Date.now();
  const live = await prisma.eventCache.findFirst({
    where: { status: "active", startAt: { gte: new Date(now - 4 * HOUR), lte: new Date(now + HOUR) } },
  });
  return !live;
}

const invokedDirectly = process.argv[1]?.endsWith("seed.ts");
if (invokedDirectly) {
  runSeed()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
