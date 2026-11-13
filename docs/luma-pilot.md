# Luma to Sundays

Luma keeps registration and check-in. Anyone can open `/meet` to search cards that attendees chose to share in that day’s directory. **Your pairing for today** uses a guest’s Luma project answer and optional public portfolio to suggest up to three people. Search and pairings stay on the same page.

## Run the local pilot

Use Node 22.18 or newer and install the repository dependencies. Run `npm run pilot:model` once from the repository root to install the local CPU runtime and download the pinned 23 MB MiniLM model. Then run `npm run pilot:dev` and open [Meet](http://localhost:4000/meet).

The sample room opens as Alex Rivera. Open **Zoe Chen** to see how digitizing family videos relates to restoring home movies. Open **Jamie Okafor** to see a portfolio-backed match. Searching **Blender** narrows the directory while your pairings stay visible.

To run the live local room, set these server values in the ignored `.env.local`:

- `COMMUNITY_PILOT_LIVE=true` enables real event reads.
- `LUMA_API_KEY` is the calendar API key.
- `COMMUNITY_PILOT_LUMA_EVENT_ID` identifies the Sunday to use.

The live room refreshes approved RSVPs and check-ins on demand, at most once a minute per process during the event window. The previous organizer screen is available at `/meet/pilot/host` if `COMMUNITY_PILOT_HOST_KEY` is set. It can still inspect form configuration and run a manual sync. Attendees use `/meet`.

1. Select **Use my Luma ticket** and choose a screenshot of the QR code from the Luma confirmation or ticket page. The browser reads the image locally. The server verifies the QR code against the configured event and uses a session cookie for the attendee’s card. A decoded QR link can also be pasted. [Luma ticket QR reference](https://help.luma.com/p/external-check-in-integration)
2. Select **Preview my card** to use the project answer and any submitted portfolio. After Luma check-in, the guest can see their pairings while keeping their own card private.
3. Select **Share in today’s search** to publish the preview to everyone using the directory during that event. The portfolio is optional, and **Keep private** takes the card out of search. Existing cards shared through the older attendee-only flow require the new sharing choice before they can appear for anonymous visitors.

The local database is `.sundays-pilot/pilot.sqlite` and stays outside Git along with the environment file. Both `npm run pilot:dev` and `npm run pilot:start` bind to `127.0.0.1`.

## Questions on the Luma event

The November 22 event has the required **“what are you working on?”** text question with an extra instruction after the question mark. The optional portfolio field was absent when the event metadata was checked.

In **Manage Event → Registration → Registration Questions**, keep the project question and add a **Website** field labeled **Website or portfolio**, with **Required** off. Guests who registered earlier can use their project answer alone. Luma applies new questions to new registrations. [Luma registration questions](https://help.luma.com/p/collect-registration-questions)

## Preview, matching and cost

Preview is the attendee’s approval to use their RSVP answer and read the submitted public portfolio. **Remove my card** erases the preview and blocks the RSVP from reappearing on a later sync for that event.

Pairing compares short passages from the current Luma answer and any included portfolio. TypeScript scores specific shared topics and the similarity of 384-dimensional vectors from MiniLM. It prefers evidence from current project answers, skips weak matches, and shows the original excerpts. Directory search still matches names and words in shared project or portfolio text. Pairings use the whole eligible room.

The model runs on the Meet server’s CPU in a Node worker. The worker reads model files from `.sundays-pilot/models/minilm-l6-v2` and performs inference without network access. Unchanged passages reuse an in-memory vector for up to 15 minutes. Setup is the only step that downloads model files. The live room still uses Luma for RSVP and check-in, and can fetch a portfolio that an attendee supplied.

Set `COMMUNITY_PILOT_EMBEDDINGS=off` to use the text rules only. The same fallback works if the model or local runtime is missing. To place the weights in a different directory, set `COMMUNITY_PILOT_MODEL_DIR` in the shell when running setup and in the server environment when running Meet.

## Data boundaries

- The roster stores the RSVP name, a scoped guest reference, check-in status and a keyed fingerprint of the two fields. The Luma guest-list response also contains contact and ticket data, which are discarded. Ticket sign-in sends the QR key only to the documented Luma API over HTTPS and stores an opaque session. The project and link are used for the card after the attendee selects **Preview my card**. [List Guests](https://docs.luma.com/reference/get_v1-events-guests-list) · [Get Guest](https://docs.luma.com/reference/get_v1-events-guests-get)
- The reader opens the submitted public HTTPS page and up to one linked About or Work page on the same site. It validates and pins public addresses, bounds redirects and parsing, and extracts short text excerpts. Use a direct page URL. Private links, pages that require URL parameters or fragments, and unreadable portfolios fall back to the project answer.
- A refresh preserves a preview while the source is unchanged. An edited answer or link removes the prior card from discovery and requires a new review. Cancelled guests lose claim access. Discovery responses revalidate on focus, when opening a card, and after at most one minute.
- A single checked-in ticket establishes attendance. Multi-ticket registrations stay marked as RSVPs because one scan can belong to someone other than the person who answered the form.

For attendees to use this from their own phones, the pilot needs an attendee-accessible HTTPS deployment and durable storage. Test with a consenting attendee’s Luma ticket before enabling the room at an event.
