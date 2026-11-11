# Luma to Sundays

Luma keeps registration and check-in. The local Sundays pilot turns approved, opted-in RSVPs into private cards. A host verifies the person and hands them a one-time claim link. The member can edit the card, share it for the session, make it private again, or remove it. Introductions reuse the same matcher as `/meet` and only include shared, checked-in cards in that event.

## Run the local pilot

Use Node 22.18 or newer and install the repository dependencies. Put these settings in an owner-only, ignored `.env.local`:

- `COMMUNITY_PILOT_HOST_KEY`: a locally generated random key of at least 32 characters.
- `LUMA_API_KEY`: an optional calendar-scoped key for reading the real event. Sample mode does not need it.
- `COMMUNITY_PILOT_LUMA_EVENT_ID`: the single event the key may read through this pilot.

Run `npm run pilot:dev`, or `npm run build` then `npm run pilot:start`. Both pilot start commands bind to `127.0.0.1`. Visit [the host panel](http://localhost:4000/meet/pilot) and sign in with the host key. On your machine, `node --env-file=.env.local -p 'process.env.COMMUNITY_PILOT_HOST_KEY'` shows just the local host key. The Luma key is never used to sign in to the host panel.

1. **Check event** shows the configured event and which registration questions are recognized, without requesting the guest list.
2. **Import sample RSVPs** gives you four synthetic guests. Create a claim link for Jamie, open it, and optionally add `sound design` as their offer before sharing. Create a claim link for Alex and open their introductions; Jamie can appear. Sam can share a card but does not appear until checked in.
3. **Sync guests** is available only after Luma has the optional opt-in below. Repeat it after arrivals to refresh attendance. This pilot sync is host-triggered. Live discovery closes outside the event window and asks for a refresh after 15 minutes without a completed sync.

The member claim link works once, for 20 minutes, and is intended for direct handoff after the host verifies the guest. The host panel keeps the RSVP name even if the member edits their display name, and blocks ambiguous duplicate names. The signed-in member only sees their own draft until eligible to view session introductions. A database is created at `.sundays-pilot/pilot.sqlite` with private local permissions. Keep that directory and the environment file outside Git.

## Questions on the Luma event

The configured November 22 event was verified against the real Luma API: it already has the required **“what are you working on?”** text question. It did not have the discovery opt-in or optional project link when inspected. The event was not changed, and its roster was not requested.

In **Manage Event → Registration → Registration Questions**, keep the project question and add these two optional fields when ready:

| Type | Exact label |
| --- | --- |
| Checkbox | Use my RSVP answers and shared link to prepare a private Sundays intro card for my review. |
| Website | Link to what you make |

The checkbox must be **optional**. The adapter looks up the current question IDs and accepts a boolean `true` answer to the exact checkbox. An RSVP, an unrelated checkbox, and a URL by themselves cannot create a card. New form questions only apply to new registrations; do not assume existing guests consented. [Luma registration questions](https://help.luma.com/p/collect-registration-questions)

## Data boundaries

- The adapter uses fixed-host GETs for [event metadata](https://docs.luma.com/reference/get_v1-events-get) and [paginated guests](https://docs.luma.com/reference/get_v1-events-guests-list). It checks the form first and rejects incomplete snapshots.
- Guest emails, phone numbers, ticket codes, unrelated answers, and raw responses are not written to the pilot store. Optional links remain private unless the member explicitly shares them. LinkedIn, GitHub, and portfolio links are stored as links; the Luma sync does not crawl them.
- The store keeps approved edits across refreshes. If consent or approval disappears in a complete refresh, the card and claim access are removed. Removing a card locally leaves only a non-identifying suppression hash for that event to prevent a later refresh restoring it.
- Introductions expire after at most one minute and revalidate on focus or before opening a card. The server always rechecks event eligibility. An older sync cannot reopen an event after a newer inspection found the consent question missing.
- A single ticket with a check-in timestamp can establish the guest's attendance. Multi-ticket registrations stay as RSVPs in this pilot because one ticket scan does not reliably identify the person who answered the form.
- The preview requires an explicit flag, local requests and host or member authorization. It is disabled on Vercel. The existing fictional `/meet` experience does not read from the pilot.

Before a production launch, use a durable hosted store, verified member sign-in and event-scoped access, plus a scheduled check-in refresh and a real retention policy. This branch sends no claim emails and does not change Luma registrations or check-ins.
