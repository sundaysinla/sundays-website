# The Suggestions Basket

## Site and references

The live site leads with a chrome wordmark, then gets its warmth from physical things like tilted Polaroids, paper captions, and the stamped lime accent in Projects. At 390 px the wordmark becomes a still image and the Polaroids stack. The Basket has a plain Suggestions link in the desktop navigation and beside the mobile menu. The Join Us and Attend a Session buttons carry the strongest visual weight. A direct `/basket` URL is available to share at a session once there's a hosted version.

The public site runs on Next.js and reads project content from Notion. Its timer stores state in the browser. Luma handles RSVPs. There is no production member portal, host authentication, or writable feedback database in `main`. The separate discovery pilot provided a precedent for a loopback-only host key.

Kelli Anderson's paper engineering informed the visible crease and the moment the slip disappears behind the rim. Emil Kowalski's feedback example informed a single motion tied to a successful action. GOV.UK's confirmation pattern informed the persistent receipt and next step. WCAG's guidance informed the still version of the experience. [Origami Folding Folder](https://kellianderson.com/books/foldingfolder.html) · [Purposeful animations](https://emilkowal.ski/ui/you-dont-need-animations) · [Confirmation pages](https://design-system.service.gov.uk/patterns/confirmation-pages/) · [Animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

## Directions

| Direction | Fit and tone | Interaction and small screens | Implementation |
| --- | --- | --- | --- |
| **Woven basket** | A two-ink wicker illustration, ruled note paper, and an olive slip echo the site's real-world ephemera. The handoff feels personal and private. | The note folds and drops behind the rim after saving. The artwork becomes compact above the note on a phone. A native form and still receipt carry the whole interaction. | A layered SVG and a short CSS animation keep the art editable and the assets small. The rim provides real occlusion without a 3D scene. |
| **Studio pinboard** | Offset paper scraps echo the Polaroids most directly. An open wall suggests other people can read the notes. | Pinning a note has a crisp snap. The cards need more space and hierarchy on a phone, especially alongside a private composer. | CSS layers are straightforward. The apparent public surface would need more copy to explain what is private. |
| **Seed packet** | A printed seed envelope uses the editorial type and suggests ideas can grow over time. It ties to the garden metaphor and feels more whimsical. | A paper seed could slip into the envelope or sprout. A small packet scales down well, but growth at submission would imply a host has already acted. | Simple SVG in the composer. Meaningful growth stages would introduce extra state and graphics in the host and recap experience. |

The left column is for writing and the right column is the illustrated basket. On a phone, the illustration sits between the short intro and the form. The homepage's white background and dashed grid sit behind the note and cards, which use its warm stone and paper colors. Muted olive ties the vote controls, receipt stamp, and illustrated slips together. Office Times and Editorial set the headlines. Monument Grotesk labels the controls.

The masthead shares the homepage's chrome smiley, gutters, and responsive wordmark. The wordmark uses the 3D model on desktop and the original still image on phones, with reduced motion, or if the model is unavailable. The main actions use the homepage's rounded black button treatment.

Playwright screenshots and the existing CSS and font files grounded the design. Agent Reach's Exa backend found paper references. The frontend-design and Emil design engineering skills informed the composition and feedback timing. Figma, Paper, and image generation were available for standalone art studies. The final illustration needed separately addressable slips, rim, and basket body, so it lives in editable SVG in the component. Existing Framer Motion would be useful for interruptible gestures. Here the movement is a short, fixed sequence. Canvas and the site's Three.js stack would add a rendering surface without improving the fold or the handoff.

Morph's semantic search and editing endpoints returned 402. Source inspection and focused patches were used for the repository work.

## Posting and discussion

1. Notes go to hosts by default. Checking **Post publicly so anyone can see it** puts the original text under **From the Basket** as soon as the write commits. Earlier recap consent applies to the host-written recap alone. Existing rows start with public posting off after migration.
2. Each public suggestion has an upvote, a downvote, and a net score. A browser can change or clear its vote. The first vote creates a random browser cookie. The database stores its hash to identify that vote.
3. Cards show two recent comments. Open a discussion to read ten comments at a time or leave a public reply. Opaque request keys make retries safe. A honeypot and persistent rate limits guard submissions.
4. The host inbox distinguishes private notes, public posting consent, and earlier recap consent. Hosts can hide or restore individual replies. Archiving a public note takes down its discussion. Version checks protect concurrent host reviews.

## Run locally

Use Node 22.18 or later and any local Postgres 15+. Homebrew's `postgresql@15` works, as does `supabase start` from the Supabase CLI (its database URL is printed on start). Create an empty database, then write the ignored `.env.local` with a random host key of at least 32 characters. The command below creates the file only if it is absent.

```sh
createdb sundays_basket
node -e 'const { randomBytes } = require("node:crypto"); require("node:fs").writeFileSync(".env.local", "SUGGESTIONS_BASKET_HOST_KEY=" + randomBytes(32).toString("base64url") + "\nSUGGESTIONS_BASKET_DATABASE_URL=postgresql://localhost/sundays_basket\n", { flag: "wx", mode: 0o600 })'
npm ci
npm run basket:db:setup
npm run basket:dev
```

Open [The Suggestions Basket](http://localhost:4010/basket) and [the host inbox](http://localhost:4010/basket/host) on the same hostname. To read the local host key in your terminal, run `node --env-file=.env.local -p 'process.env.SUGGESTIONS_BASKET_HOST_KEY'`. The local homepage shows Suggestions in its top navigation when started with `basket:dev`.

To exercise the full loop, write a note and check **Post publicly so anyone can see it**. Follow **See your post**, then open the same Basket URL in a second browser to vote and comment. Sign in as a host and set the status to Archived to take the post and discussion down.

Local development only uses `SUGGESTIONS_BASKET_DATABASE_URL`. It never falls back to `POSTGRES_URL`, so pulling Vercel's environment into `.env.local` cannot point a dev server at the production Basket. The Basket stores the text people submit and asks writers to omit identifying details. The local limits allow 30 new notes, 60 comments, 240 vote changes, and eight host key attempts per five-minute window. The host key issues a two-hour, same-site, HTTP-only session.

`npm test` exercises the request handler and hosted configuration. The database tests need a disposable Postgres server. Each test creates and drops its own database there:

```sh
BASKET_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres npm test
```

Without that variable the database tests are skipped. Run `./node_modules/.bin/tsc --noEmit --incremental false` separately because the existing Next.js build skips type checks.

## Set up Supabase and Vercel

The Basket stores everything in Supabase Postgres. The schema lives in [`supabase/migrations/20261115000000_suggestions_basket.sql`](../supabase/migrations/20261115000000_suggestions_basket.sql). It creates a private `basket` schema with row level security on every table and revokes access from Supabase's `anon` and `authenticated` roles, so the publishable key that the integration exposes to browsers cannot read or write notes. Only the server reaches the tables, through the Postgres connection string. Running the file again is safe.

1. **Create the database.** In your Sundays Vercel project, open **Storage** (or the Marketplace), choose **Supabase**, and create a project on the Free plan in a West Coast region. Connect it to the Production environment. The integration adds `POSTGRES_URL` (the pooled connection the Basket uses), `POSTGRES_URL_NON_POOLING`, and the Supabase API keys. [Supabase on the Vercel Marketplace](https://supabase.com/docs/guides/integrations/vercel-marketplace)
2. **Create the tables.** In the Supabase dashboard, open **SQL Editor**, paste the migration file, and run it. From a checkout you can instead pull the production variables into an ignored file and run the setup script, which prefers the direct connection:

   ```sh
   vercel env pull .env.basket-production.local --environment=production
   node --env-file=.env.basket-production.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/setup-basket-db.mjs
   ```

3. **Add the Basket variables** to the Production environment in Vercel:

   | Variable | Value |
   | --- | --- |
   | `POSTGRES_URL` | Set by the Supabase integration. The Basket accepts any `postgres://` URL and always connects over TLS to non-local hosts |
   | `SUGGESTIONS_BASKET_DATABASE_CA` | Supabase's root certificate, from **Project Settings → Database → SSL Configuration → Download certificate**. Paste the whole PEM file (escaped `\n` line breaks also work) |
   | `SUGGESTIONS_BASKET_SESSION_SECRET` | 32-byte random secret, encoded as base64url |
   | `SUGGESTIONS_BASKET_HOSTS` | JSON object mapping organizer IDs to SHA-256 hex digests of their keys |
   | `SUGGESTIONS_BASKET_ORIGINS` | `https://sundays-website-managementmos-projects.vercel.app` (the temporary production domain; add `https://www.sundays.rsvp` when that custom domain is in use) |
   | `SUGGESTIONS_BASKET_ENABLED` | `true` |
   | `CRON_SECRET` | Random string of at least 16 characters. Vercel Cron sends it to the daily keepalive |

4. **Redeploy** Production. `/basket` and `/basket/host` appear once every value is present.

With `SUGGESTIONS_BASKET_DATABASE_CA` set, the Basket verifies the database's certificate and hostname, so nothing on the network can impersonate Supabase and capture the database password. Without it, the connection is still encrypted (`sslmode=require`) but the certificate is not checked. A `sslmode=verify-full` in the URL is honored against the system CAs. A value that isn't a PEM certificate turns the Basket off instead of skipping verification. Use the same variable when running the setup script from a checkout.

Generate a session secret or cron secret using `node -p 'require("node:crypto").randomBytes(32).toString("base64url")'`. Generate a key for each organizer, replacing `alex` with their ID.

```sh
node -e 'const {randomBytes,createHash}=require("node:crypto"); const id=process.argv[1]; const key=randomBytes(32).toString("base64url"); console.log(id+"."+key); console.log(JSON.stringify({[id]:createHash("sha256").update(key).digest("hex")}));' alex
```

Share the first line with that organizer through the team’s password manager. Combine the JSON entries from the second line into `SUGGESTIONS_BASKET_HOSTS`. Organizers enter the full key at `/basket/host`. Remove or replace an organizer’s digest and redeploy to revoke their key and sessions on the active deployment. Each session lasts two hours and uses a Secure, HTTP-only cookie. Hosts can also read every note directly in Supabase's Table Editor under the `basket` schema.

**Free plan pausing.** Supabase pauses Free projects after about a week without activity. `vercel.json` schedules a daily Vercel Cron request to `/api/suggestions/keepalive`, which makes one small read from the Basket database when `CRON_SECRET` matches. If the project is ever paused anyway, restore it from the Supabase dashboard. Notes are kept while it is paused. [Supabase pricing](https://supabase.com/pricing)

**Preview deployments.** Preview stays off unless `SUGGESTIONS_BASKET_ENABLED=true` is set for Preview. To test there, create a second Free Supabase project, run the migration on it, and set its pooled connection string as `POSTGRES_URL` for the Preview environment along with Preview copies of the other variables. Don't point Preview at the production database. Preview serves the Basket on the Vercel deployment and branch URLs.

Hosted limits allow six new notes, 15 comments, 90 vote changes, and eight host key attempts per IP address every five minutes. The database keeps a keyed hash for those counters. Visitors sharing Wi-Fi may share a limit. Production only serves the Basket on the configured public origin.

After launch, verify a private note, an opted-in public note, a vote, and a reply. Check the signed-out inbox and the public board for private text. Sign in, hide and restore the reply, and verify both states from a separate browser. Set `SUGGESTIONS_BASKET_ENABLED=false` and redeploy to turn the Basket off while keeping stored notes.

## Browser verification

The original Playwright walkthrough covered keyboard submission, reduced motion, receipt focus, legacy recap publication, and host sign-in. The discussion walkthrough uses two isolated browser contexts to check visibility, reversible votes, comment preview and pagination, and archiving. It also simulates a lost reply response after the database commits to check that retrying adds one comment. Test notes and screenshots use a disposable database.
