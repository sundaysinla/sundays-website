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
2. Each public suggestion has an upvote, a downvote, and a net score. A browser can change or clear its vote. The first vote creates a random browser cookie. SQLite stores its hash to identify that vote.
3. Cards show two recent comments. Open a discussion to read ten comments at a time or leave a public reply. Opaque request keys make retries safe. A honeypot and persistent aggregate limits guard notes and comments.
4. The host inbox distinguishes private notes, public posting consent, and earlier recap consent. Archiving a public note takes down its discussion. Version checks protect concurrent host reviews.

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

`npm test` exercises the actual SQLite store and request handler. Run `./node_modules/.bin/tsc --noEmit --incremental false` separately because the existing Next.js build skips type checks.

The preview requires a loopback server and is disabled on Vercel. A hosted release would need durable shared storage, individual organizer sign-in, and public-facing abuse controls. The `lib/suggestions` request and store boundary is where those adapters fit.

## Browser verification

The original Playwright walkthrough covered keyboard submission, reduced motion, receipt focus, legacy recap publication, and host sign-in. The discussion walkthrough uses two isolated browser contexts to check visibility, reversible votes, comment preview and pagination, and archiving. It also simulates a lost reply response after SQLite commits to check that retrying adds one comment. Test notes and screenshots use a disposable database.
