# The Suggestions Basket

## Site and references

The live site leads with a chrome wordmark, then gets its warmth from physical things like tilted Polaroids, paper captions, and the stamped lime accent in Projects. At 390 px the wordmark becomes a still image and the Polaroids stack. The footer already gathers links people use after reading about Sundays. The Basket fits there and has a direct `/basket` URL that a host could share at a session. A new main-nav item would give occasional feedback the same weight as joining an event. A session link could be especially timely once there's a hosted version.

The public site runs on Next.js and reads project content from Notion. Its timer stores state in the browser. Luma handles RSVPs. There is no production member portal, host authentication, or writable feedback database in `main`. The separate discovery pilot provided a precedent for a loopback-only host key and a local SQLite file.

Kelli Anderson's paper engineering informed the visible crease and the moment the slip disappears behind the rim. Emil Kowalski's feedback example informed a single motion tied to a successful action. GOV.UK's confirmation pattern informed the persistent receipt and next step. WCAG's guidance informed the still version of the experience. [Origami Folding Folder](https://kellianderson.com/books/foldingfolder.html) · [Purposeful animations](https://emilkowal.ski/ui/you-dont-need-animations) · [Confirmation pages](https://design-system.service.gov.uk/patterns/confirmation-pages/) · [Animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

## Directions

| Direction | Fit and tone | Interaction and small screens | Implementation |
| --- | --- | --- | --- |
| **Woven basket** | A two-ink wicker illustration, ruled note paper, and an olive slip echo the site's real-world ephemera. The handoff feels personal and private. | The note folds and drops behind the rim after saving. The artwork becomes compact above the note on a phone. A native form and still receipt carry the whole interaction. | A layered SVG and a short CSS animation keep the art editable and the assets small. The rim provides real occlusion without a 3D scene. |
| **Studio pinboard** | Offset paper scraps echo the Polaroids most directly. An open wall suggests other people can read the notes. | Pinning a note has a crisp snap. The cards need more space and hierarchy on a phone, especially alongside a private composer. | CSS layers are straightforward. The apparent public surface would need more copy to explain what is private. |
| **Seed packet** | A printed seed envelope uses the editorial type and suggests ideas can grow over time. It ties to the garden metaphor and feels more whimsical. | A paper seed could slip into the envelope or sprout. A small packet scales down well, but growth at submission would imply a host has already acted. | Simple SVG in the composer. Meaningful growth stages would introduce extra state and graphics in the host and recap experience. |

The woven basket best expresses a quiet handoff, and the paper treatment keeps it recognizable as Sundays. The left column is for writing and the right column is the illustrated object. On a phone, the illustration sits between the short intro and the form. Warm paper and near-black ink carry the page. Muted olive ties the selected category, receipt stamp, and illustrated slips together. A checkmark identifies the selected category. Office Times and Editorial set the headlines. Monument Grotesk labels the controls.

Playwright screenshots and the existing CSS and font files grounded the design. Agent Reach's Exa backend found paper references. The frontend-design and Emil design engineering skills informed the composition and feedback timing. Figma, Paper, and image generation were available for standalone art studies. The final illustration needed separately addressable slips, rim, and basket body, so it lives in editable SVG in the component. Existing Framer Motion would be useful for interruptible gestures. Here the movement is a short, fixed sequence. Canvas and the site's Three.js stack would add a rendering surface without improving the fold or the handoff.

Morph's semantic search and editing endpoints returned 402. Source inspection and focused patches were used for the repository work.

## Implementation plan

1. Pin persistence, request validation, retry, host permissions, and publication rules with temporary SQLite tests. The server accepts a category, a note, and optional consent for a host-written recap. An opaque request key makes a retry safe. A honeypot and persistent aggregate limits guard the local endpoints without collecting IP addresses or member IDs in the Basket database.
2. Add the member page, composer, illustration, and recaps. Confirm immediately after a committed write. Let motion illustrate the success without controlling it. Preserve the draft on failure.
3. Add the host inbox and filters. Keep raw notes private. Hosts can save review status and outcome, and publish a separate idea summary and outcome only after consent and a Tried or Implemented status. Archiving removes a recap. Version checks prevent an older review from overwriting a newer one.
4. Test the isolated local workflow in desktop and mobile browsers. Cover keyboard and reduced-motion use, failure and retry, empty states, permission checks, and a recap being published and taken down.

## Run locally

Use Node 22.18 or later. Generate a host key once and set `SUGGESTIONS_BASKET_HOST_KEY` in the ignored `.env.local` file. Use a random key of at least 32 characters. This command creates the file only if it is absent.

```sh
node -e 'const { randomBytes } = require("node:crypto"); require("node:fs").writeFileSync(".env.local", "SUGGESTIONS_BASKET_HOST_KEY=" + randomBytes(32).toString("base64url") + "\n", { flag: "wx", mode: 0o600 })'
npm ci
npm run basket:dev
```

Open [The Suggestions Basket](http://localhost:4010/basket) and [the host inbox](http://localhost:4010/basket/host) on the same hostname. To read the local host key in your terminal, run `node --env-file=.env.local -p 'process.env.SUGGESTIONS_BASKET_HOST_KEY'`. The local homepage also links to the Basket from its footer when started with `basket:dev`.

To exercise the full loop, leave a note and allow a recap. Sign in as a host, set its status to Tried, write an idea summary and outcome, check Publish, and save. Reload the member page to see the recap. Archive the note or clear Publish to take it down.

Notes survive server restarts in `.sundays-basket/basket.sqlite`. Set `SUGGESTIONS_BASKET_DB_PATH` to use another local file. The Basket collects no account, name, email, or IP address in its database. Hosts can see the note itself, so the form asks writers to omit identifying details. Only the authored recap fields can appear in the showcase. The local limits allow 30 new notes and eight host key attempts per five-minute window. The host key issues a two-hour, same-site, HTTP-only session.

`npm test` exercises the actual SQLite store and request handler. Run `./node_modules/.bin/tsc --noEmit --incremental false` separately because the existing Next.js build skips type checks.

The preview requires a loopback server and is disabled on Vercel. A hosted release would need durable shared storage, individual organizer sign-in, and public-facing abuse controls. The `lib/suggestions` request and store boundary is where those adapters fit.

## Browser verification

Playwright exercised the member view at 1440 px, 390 px, and 320 px. The walkthrough covered keyboard selection and submission, reduced motion, receipt focus, and a deliberately lost response after SQLite committed. Retrying produced one inbox note. It also covered a locked and empty inbox, sign-in, category filtering, recap publication, archiving, and sign-out. The showcase exposed the recap only, and the Basket loaded neither of the homepage's 3D assets. Screenshots used a disposable SQLite database and fictional notes.
