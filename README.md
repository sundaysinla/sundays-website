# Sundays in LA

Marketing site + membership portal for Sundays coworking sessions.

## Stack

- Next.js 14 (App Router)
- Tailwind + brand fonts
- Auth.js (Google + Resend magic link)
- Neon Postgres via Prisma 7 + `@prisma/adapter-pg`
- Luma Calendar API (events, RSVP, past attendance)
- Mapbox (geocoding, address autocomplete, host map, driving routes)

## Setup

1. Copy env template and fill values:

```bash
cp .env.example .env.local
```

Required:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | e.g. `http://localhost:4000` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `AUTH_RESEND_KEY` or `RESEND_API_KEY` | Magic links + emails |
| `EMAIL_FROM` | Verified Resend from-address |
| `LUMA_API_KEY` | Luma Plus calendar API key |
| `MAPBOX_TOKEN` | Mapbox **public** token (`pk.…`). Used server-side for geocoding and shipped to the browser for the map and autocomplete, so it must be a public token with URL restrictions set in Mapbox. |
| `ADMIN_EMAILS` | Comma-separated host emails for `/portal/admin` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | Optional. Carpool texts (confirmations, car-chat notices). Without them, texts are logged and skipped; email still goes out. |

Optional: `NEXT_PUBLIC_MAPBOX_TOKEN` if you want a separate browser token from the server one.

These must also be set in the Vercel project (Settings → Environment Variables). The GitHub deploy workflow only forwards the Notion secrets; everything else comes from Vercel.

2. Push schema and generate client:

```bash
npm install
npm run db:push
npm run db:generate
```

3. Run:

```bash
npm run dev
```

Site: [http://localhost:4000](http://localhost:4000)  
Portal: [http://localhost:4000/portal](http://localhost:4000/portal)

4. Tests (pure carpool routing + matcher):

```bash
npm test
```

## Portal routes

- `/portal/login` — Google or email magic link
- `/portal` — home (demos + attendance)
- `/portal/profile` — edit profile, contact email, demos
- `/portal/rsvp` — one-click Luma RSVP
- `/portal/carpool` — post "need a ride" / "can drive", see your car once hosts arrange it
- `/portal/admin` — host board (`ADMIN_EMAILS`): map, cars, suggest placements, write-ins
- `/portal/admin/checkin` — the door list: RSVPs pulled from Luma, tap to check in, add walk-ins
- `/portal/met` — "who did you meet?": tap the people you talked to at a Sunday you were checked in for

## Carpool model

- One `CarpoolOffer` per person per event: role (driver / rider), geocoded start or pickup point, seats, notes. Hosts can write people in without an account (`guestName` / `guestEmail`); signing up with that email later claims the entry.
- A driver's offer owns a `Car` (`kind = drive`); a rider's offer sits in at most one `CarStop` with an `order`, in a driven car or an Uber group.
- Matching is host-triggered ("Suggest placements"): greedy cheapest insertion over straight-line distance (`lib/carpool/route.ts`). Host placements and confirmed stops are never moved; unconfirmed suggestions are redone each time.
- Members see first names and neighborhoods only. Full names, addresses and contact emails appear after a host presses **Confirm car**, which emails everyone in the car once. Later edits show as "Send changes".
- The host map draws each car's route with Mapbox Directions (falls back to straight dashed lines). A host can move one pin at a time with **Fix pin**; moved pins are reverse-geocoded.
- **Import a spreadsheet** (host board): `.csv` / `.xlsx` with `name, email, phone, role, address, seats, notes, car`. Preview geocodes and flags problems; import writes people in and seats riders with the named driver. Template at `/carpool-import-template.csv`. Handy for test data.
- **Car chat**: once someone is the driver or seated in a car they can post in that car's thread on `/portal/carpool`; hosts can post from the board. Each message texts (if a phone is on file) or emails the others, throttled to one notice per person per 30 minutes.
- **Uber groups** (short on drivers): a `Car` with `kind = rideshare` has no driver. Its riders walk to a campus meetup spot (`hubId`: De Neve turnaround at UCLA, USC Village at USC; coordinates in `lib/carpool/rideshare.ts`) and share one Uber to the venue. **Uber the rest** on the host board sends every rider still without a ride to their nearest spot within 3 km, tops up open seats in existing groups there, then opens evenly sized new groups of up to 4 (5 riders → 3 + 2). Riders farther than that stay unassigned for a host to place. Each group has a meet time (default: the estimated drive plus 15 minutes, editable), a meetup spot, 1–6 seats (5+ means an XL), and who orders it: a host, or one of the riders. **Confirm Uber** texts or emails each rider the spot, time, who they're riding with, and who orders. Other riders' home locations stay hidden; the member map shows only the spot and the route. Re-running **Suggest placements** clears unconfirmed auto-grouped riders (so new drivers can take them) and drops empty unsent groups.
- **Phone numbers**: members add one on their profile or the carpool form; hosts add one for write-ins and imports. Stored E.164 (`lib/phone.ts`). Shared with the car after a host confirms it, and used for confirmation texts and car-chat notices, including for people without an account.

## Attendance and meetings

- `Attendance` is one row per person per Sunday. Members have a `userId`; Luma RSVPs and walk-ins without an account are kept by `guestEmail` / `guestName` and claimed on sign-up. Hosts pull the guest list per event (`syncEventGuests`) and check people in at `/portal/admin/checkin`; Luma has no check-in field, so the portal's `checkedInAt` is the truth. The event's Luma hosts are synced too, with status `host`, and are checked in automatically from an hour before start. Attendance rows are matched to members by login, contact, or Luma email, and any guest rows under one of those emails are claimed when the member opens their people pages.
- `Meeting` links two attendance rows at one Sunday (`aId < bId`), with a private note per side (`noteA` / `noteB`). Members mark people at `/portal/met` from the checked-in list; the page opens the moment a host checks them in and refreshes itself while the Sunday is on, so arrivals appear live. The profile page draws the met-graph from these and shows each note.
- A Vercel cron (`vercel.json`, Mondays 9am PT, `/api/cron/met-nudge`, guarded by `CRON_SECRET`) emails everyone checked in the day before with a link to mark who they met.

## Brand

The portal follows the Sundays Brand & Marketing Guidelines (Aug 2026). The rules live in the project skill at `../.claude/skills/sundays-brand/SKILL.md` (with the PDF and a `tokens.json` beside it) and in `tailwind.config.js` as tokens: `paper`, `paper-2`, `ink`, `blueberry`, `blueberry-200`, `lime`, and font roles `font-heading` (PP Editorial New Ultralight), `font-body` / `font-mono` (Office Times Sharp), `font-ui` (PP Neue Montreal, falling back to Monument Grotesk until the Montreal files are added to `public/fonts`). Portal components use those tokens only; the marketing homepage keeps its own styling.

## Notes

- Contact email is separate from login identity and can be changed (verify link) so graduating students keep access.
- On a member's first portal visit, past Luma registration answers are imported into their demo history.
- **Deleted or cancelled Sundays**: each sync checks cached upcoming events that Luma no longer lists. A 404 marks the event `deleted`; an event Luma still returns but no longer lists is marked `cancelled` (it flips back to `active` if it reappears). Only `active` events count as "this week". Carpool entries built for a vanished event move automatically to an active event starting within 36 hours of it; otherwise the host board shows a "Move them here" button. Luma RSVPs never carry over, because the recreated event has a fresh guest list.
- The Luma API key belongs to one calendar. An event created on another calendar (a personal one, or a submitted event awaiting calendar approval) never appears in the list, and the portal will keep saying there is no upcoming Sunday.
- Without `LUMA_API_KEY` / `MAPBOX_TOKEN`, portal UI still loads; RSVP/carpool actions surface clear errors and fall back to the public Luma link.
