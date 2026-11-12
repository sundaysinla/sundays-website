# Luma to Sundays

Luma keeps registration and check-in. The local pilot uses the existing project answer and an optional public portfolio. A host verifies the attendee and hands them a one-time claim link. The attendee previews their card, chooses what to share, and can browse other people who shared a card and checked in for the same Sunday.

## Run the local pilot

Use Node 22.18 or newer and install the repository dependencies. Put these settings in an owner-only, ignored `.env.local`:

- `COMMUNITY_PILOT_HOST_KEY`: a locally generated random key of at least 32 characters.
- `LUMA_API_KEY`: an optional calendar-scoped key for reading the real event. Sample mode does not need it.
- `COMMUNITY_PILOT_LUMA_EVENT_ID`: the single event the key may read through this pilot.

Run `npm run pilot:dev`, or `npm run build` then `npm run pilot:start`. Both commands bind to `127.0.0.1`. [Meet](http://localhost:4000/meet) opens the host panel while the pilot is enabled. On your machine, `node --env-file=.env.local -p 'process.env.COMMUNITY_PILOT_HOST_KEY'` shows the local host key for signing in.

1. **Check event** shows the configured event and which registration questions it recognizes. This calls the event metadata endpoint.
2. **Import sample RSVPs** gives you four synthetic guests. Open Jamie’s claim link, select **Preview my card**, and select **Share today** with the portfolio included. Open Alex’s claim link, preview the card, then select **See who’s here**. The short films suggestion connects Alex’s project answer to Jamie’s sample portfolio. **Why you two** shows both excerpts. Casey can match Alex from their project answers alone after sharing. Sam's RSVP cannot establish attendance.
3. **Sync guests** reads approved RSVPs for the configured event. Repeat it after arrivals to refresh check-in status. Live discovery uses a 15-minute attendance snapshot and closes at the event’s end.

Each link works once for 20 minutes. Verify the RSVP in Luma before handing the person their link. Duplicate RSVP names require a host to resolve the ambiguity before issuing a link. The local database is `.sundays-pilot/pilot.sqlite` and stays outside Git along with the environment file. On the first write, the new version clears earlier editable pilot drafts and their claim sessions, while retaining event-specific removal requests. Import sample RSVPs again if you used the previous preview.

## Questions on the Luma event

The November 22 event already has the required **“what are you working on?”** text question with an extra instruction after the question mark. **Check event** recognizes it. The optional portfolio field was absent when the event metadata was checked.

In **Manage Event → Registration → Registration Questions**, keep the project question and add a **Website** field labeled **Website or portfolio**, with **Required** off. Guests who registered earlier can use their project answer alone. Luma applies new questions to new registrations. [Luma registration questions](https://help.luma.com/p/collect-registration-questions)

## Preview, matching and cost

Preview is the attendee’s approval to use their RSVP answer and read the submitted public portfolio. Sharing publishes the preview to checked-in attendees during that event, with a choice to include the portfolio. An attendee can also browse while private. **Make private** hides their card. **Remove my card** erases the preview and blocks the RSVP from reappearing on a later sync for that event.

The matcher compares project answers and approved excerpts for specific topics and phrases. It prefers a connection supported by project answers and shows the source text on each suggestion. People can search the room even when the shared work gives us too little evidence to suggest an intro. The pilot makes zero model and search API calls.

## Data boundaries

- The host roster stores the RSVP name, a scoped guest reference, check-in status and a keyed fingerprint of the two fields. The Luma guest-list response also contains contact and ticket data, which are discarded. The single-guest lookup loads the project and link after the attendee selects **Preview my card**. [List Guests](https://docs.luma.com/reference/get_v1-events-guests-list) · [Get Guest](https://docs.luma.com/reference/get_v1-events-guests-get)
- The reader opens the submitted public HTTPS page and up to one linked About or Work page on the same site. It validates and pins public addresses, bounds redirects and parsing, and extracts short text excerpts. Use a direct page URL. Private links, pages that require URL parameters or fragments, and unreadable portfolios fall back to the project answer.
- A refresh preserves a preview while the source is unchanged. An edited answer or link removes the prior card from discovery and requires a new review. Cancelled guests lose claim access. Discovery responses revalidate on focus, when opening a card, and after at most one minute.
- A single checked-in ticket establishes attendance. Multi-ticket registrations stay marked as RSVPs because one scan can belong to someone other than the person who answered the form.

For attendees to use this from their own phones, the pilot needs an attendee-accessible HTTPS deployment, durable storage, and a verified claim handoff. Plan automatic check-in refresh and data retention before a wider rollout. The local pilot’s claims are handed out manually.
