# Live demo

The portal on a local database with a fictional cast, for showing it off
without touching Neon, Luma, email or SMS.

```bash
npm run demo:db     # throwaway Postgres in Docker (127.0.0.1:55433) + current schema
npm run demo:seed   # the cast; re-run any time to reset
npm run demo        # portal on 127.0.0.1:4020, persona panel on 127.0.0.1:4021
```

Open **http://127.0.0.1:4021**. Each link there signs you in as that person
(Jordan the member, Maya the driver, Lena the Uber booker, Richard the host)
and opens the page. The panel has the run of show and a "Reset demo data"
button.

- The demo Sunday starts a little over an hour before you seed, so check-in,
  "I met" and the carpool board are live for the next few hours whatever the
  day. Reset (or re-seed) to move it up again; `DEMO_START` (ISO time) pins it.
  The venue and the Luma page the RSVP page embeds are the real Sep 27 event's.
- `.env.demo` blanks the Resend, Luma and Twilio keys, so confirming a car
  on stage sends nothing. The seed refuses to run against a non-local database.
- The demo runs on `127.0.0.1`, not `localhost`, so its session cookie
  can't clobber a dev session on `localhost:4000`, and builds into
  `.next-demo` so it can run beside the main dev server.
