# The Suggestions Basket

## Site and references

The live site leads with a chrome wordmark, then gets its warmth from physical things like tilted Polaroids, paper captions, and the stamped lime accent in Projects. At 390 px the wordmark becomes a still image and the Polaroids stack. The Basket has a plain Suggestions link in the desktop navigation and beside the mobile menu. The Join Us and Attend a Session buttons carry the strongest visual weight. A direct `/basket` URL is available to share at a session once there's a hosted version.

The public site runs on Next.js and reads project content from Notion. Its timer stores state in the browser. Luma handles RSVPs. There is no production member portal, host authentication, or writable feedback database in `main`. The separate discovery pilot provided a precedent for a loopback-only host key and a local SQLite file.

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

Use Node 22.18 or later. Generate a host key once and set `SUGGESTIONS_BASKET_HOST_KEY` in the ignored `.env.local` file. Use a random key of at least 32 characters. This command creates the file only if it is absent.

```sh
node -e 'const { randomBytes } = require("node:crypto"); require("node:fs").writeFileSync(".env.local", "SUGGESTIONS_BASKET_HOST_KEY=" + randomBytes(32).toString("base64url") + "\n", { flag: "wx", mode: 0o600 })'
npm ci
npm run basket:dev
```

Open [The Suggestions Basket](http://localhost:4010/basket) and [the host inbox](http://localhost:4010/basket/host) on the same hostname. To read the local host key in your terminal, run `node --env-file=.env.local -p 'process.env.SUGGESTIONS_BASKET_HOST_KEY'`. The local homepage shows Suggestions in its top navigation when started with `basket:dev`.

To exercise the full loop, write a note and check **Post publicly so anyone can see it**. Follow **See your post**, then open the same Basket URL in a second browser to vote and comment. Sign in as a host and set the status to Archived to take the post and discussion down.

Notes, comments, and votes survive server restarts in `.sundays-basket/basket.sqlite`. Set `SUGGESTIONS_BASKET_DB_PATH` to use another local file. The Basket stores the text people submit and asks writers to omit identifying details. The local limits allow 30 new notes, 60 comments, 240 vote changes, and eight host key attempts per five-minute window. The host key issues a two-hour, same-site, HTTP-only session.

`npm test` exercises the SQLite store, request handler, and hosted configuration. Run `./node_modules/.bin/tsc --noEmit --incremental false` separately because the existing Next.js build skips type checks.

## Set up Turso and Vercel

Use the Vercel project that serves `www.sundays.rsvp`. The repo selects Node 22 for the build and functions. Create two empty **libSQL** databases on the Sundays Turso account using the Free plan. Give Preview and Production separate database URLs and database-scoped tokens. Initialize Preview first. [Turso Quickstart](https://docs.turso.tech/quickstart) · [Turso Free plan](https://turso.tech/pricing)

```sh
turso db create sundays-basket-preview
turso db show sundays-basket-preview --url
turso db tokens create sundays-basket-preview
```

Use the URL and token in an ignored `.env.basket-preview.local` file with permissions `0600`. The two variable names are `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Run the setup command from the checkout. It creates or updates the schema and can be rerun.

```sh
node --env-file=.env.basket-preview.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/setup-basket-db.mjs
```

Repeat for `sundays-basket-production` and a separate ignored env file before the production deployment.

In the Vercel project, enable automatic system environment variables and configure these server-side variables for the corresponding environment. For the CLI-based workflow in this repository, configure Preview variables for the Preview environment as a whole. Git-connected deployments also support branch-specific variables. [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables) · [Vercel environments](https://vercel.com/docs/environment-variables)

| Variable | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | URL of the database for this environment |
| `TURSO_AUTH_TOKEN` | Write-capable token scoped to that database |
| `SUGGESTIONS_BASKET_SESSION_SECRET` | Separate 32-byte random secret per environment, encoded as base64url |
| `SUGGESTIONS_BASKET_HOSTS` | JSON object mapping organizer IDs to SHA-256 hex digests of their keys |
| `SUGGESTIONS_BASKET_ORIGINS` | Production only. Set to `https://www.sundays.rsvp` |
| `SUGGESTIONS_BASKET_ENABLED` | `true` for Preview after the schema is ready. Enable Production after Preview passes |

Generate a session secret using `node -p 'require("node:crypto").randomBytes(32).toString("base64url")'`. Generate a key for each organizer, replacing `alex` with their ID.

```sh
node -e 'const {randomBytes,createHash}=require("node:crypto"); const id=process.argv[1]; const key=randomBytes(32).toString("base64url"); console.log(id+"."+key); console.log(JSON.stringify({[id]:createHash("sha256").update(key).digest("hex")}));' alex
```

Share the first line with that organizer through the team’s password manager. Combine the JSON entries from the second line into `SUGGESTIONS_BASKET_HOSTS`. Organizers enter the full key at `/basket/host`. Remove or replace an organizer’s digest and redeploy to revoke their key and sessions on the active deployment. Retire older accessible Preview deployments using those credentials. Each session lasts two hours and uses a Secure, HTTP-only cookie.

Hosted limits allow six new notes, 15 comments, 90 vote changes, and eight host key attempts per IP address every five minutes. The database keeps a keyed hash for those counters. Visitors sharing Wi-Fi may share a limit. Preview uses the Vercel deployment and branch URLs. Production only serves the Basket on the configured public origin.

Verify the Preview using a private note, an opted-in public note, a vote, and a reply. Check the signed-out inbox and the public board for private text. Sign in, hide and restore the reply, and verify both states from a separate browser. Redeploy Preview with the same database and verify the four writes are still present. Then deploy Production with the Production environment values and confirm its database starts empty. Set `SUGGESTIONS_BASKET_ENABLED=false` and redeploy to disable access while retaining stored notes.

For a local test of the hosted driver, point `BASKET_TEST_LIBSQL_URL` at a disposable TLS-protected libSQL server on `127.0.0.1` configured to accept the test bearer token `fixture`. If using a local CA, set `NODE_EXTRA_CA_CERTS` before running `npm test`. The hosted test initializes the schema and writes synthetic rows.

## Browser verification

The original Playwright walkthrough covered keyboard submission, reduced motion, receipt focus, legacy recap publication, and host sign-in. The discussion walkthrough uses two isolated browser contexts to check visibility, reversible votes, comment preview and pagination, and archiving. It also simulates a lost reply response after SQLite commits to check that retrying adds one comment. Test notes and screenshots use a disposable database.
