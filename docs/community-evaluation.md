# You Should Meet — evaluation evidence

Evaluated November 4, 2026 on the local `codex/you-should-meet` branch. The scope is a fictional, browser-local vertical slice, not a membership launch. No push, deployment, real attendee ingestion, paid-service provisioning or outbound introduction was performed.

The subsequent evaluation-copy pass removes preview banners, fictional-person labels, repeated storage explanations, decorative section intros and footer slogans. Controls use concise product labels such as “Your profile” and “Save profile.” Visibility/source consent, matching evidence, source provenance and all production gates remain in place. Original screenshots predate that copy pass; use the running `/meet` route for the current presentation.

## Automated checks

`npm test`: **52 passing tests** (49 community tests plus 3 existing Notion image tests). `npm run typecheck`: passes independently of the repository's build-time ignore setting. The community tests use Node 22 native TypeScript support; no test dependency was added.

The suite covers exact-session check-in versus RSVP, session/community consent, self/private/draft/withdrawn exclusions, focus mode, known meetings, public DTO minimization, complementary matching, determinism/diversity, source-grounded evidence, temporal relevance, query constraints, ask/offer roles, specific tool evidence, source consent, source URL/ownership/private/fork restrictions, malformed/oversized bodies, origin checks, upstream rate limits and errors, production gates, and browser persistence/reset. Unselected source details cannot enter the profile; project-only imports keep provenance through editing and storage.

The initial tests failed before domain/adapters were implemented. A fresh read-only reviewer subsequently reproduced gaps that the first green suite missed. Regression tests were added for those semantic failures before fixing them. A green fixture suite is evidence for these cases, not proof of general natural-language understanding.

## Relevance set

These eight requests come from the product brief. All have a relevant first result in the fictional dataset; the test checks the expected first-result set, not human-rated overall precision.

| Request | Scope | Expected relevant first result |
| --- | --- | --- |
| Who here knows Blender? | Here today | Casey |
| Who's working on interesting hardware projects? | Here today | Theo |
| Has anyone built an iOS app? | Community | Sam |
| Who should I talk to about making a music video? | Here today | Maya or Jamie |
| Who here is interested in education and artificial intelligence? | Here today | Sofia or Lina |
| Does anyone know motion design? | Here today | Rowan |
| Who at USC is building something related to filmmaking? | Here today | Jamie |
| Who was working on robotics last semester? | Community | Devon |

Negative cases include Blender + unsupported Houdini, a capability listed only as an interest, a sound-design ask presented as an offer, a broad web-development profile without the specifically requested React/TypeScript evidence, generic AI-assisted/education work without machine-learning experience, USC + Blender + different practice, private names, sensitive qualifiers and unknown topics. They return no matching person rather than silently dropping constraints. Help with sound design returns Jamie's explicit offer only. Explicit machine-learning evidence has a separate positive regression case.

## Browser checks

Tested in an isolated Chromium context against the local application, using fictional data and synthetic intercepted failures. Earlier flows used the development server; final integration checks used the production build locally with the fictional-preview flag enabled.

- Default: three introduction notes (Maya, Jamie, Rowan), with actual profile evidence and complementary needs.
- Discovery → member detail → local host note → mark met → optional worthwhile feedback → reload. Met members leave proactive suggestions and remain directly searchable. Host notes are displayed/copied locally; nothing is sent.
- Blender search → Casey with Blender-based conversation starter. iOS search has no present member; switching to the community finds Sam with an away label. Focus-only members have no interruption/host-introduction actions.
- Import disabled until source consent → source draft → individually selected details → edit → save → reload. A project-only import retains source URL/label/time and original text after editing its title; no interest claims are required for that provenance.
- Delayed import response → withdraw consent → release response: no stale draft reappears. Delayed old search → submit new search → release old response: only the new result remains.
- Synthetic 503 discovery error → visible retry state → successful retry. Corrupt browser storage → visible recovery notice → valid fictional default. Reset removes the storage key, imported data, meetings and feedback.
- Dialog keyboard focus stays inside the dialog and returns to its trigger after Escape. Responsive layouts checked at widths 1440, 820, 390 and 320; three cards remain present with 3/2/1 columns. Phone form fields use 16px text. Reduced-motion yields no card animation/transition. A long unbroken query revealed a heading overflow and was corrected before final capture.

Screenshots are kept outside the repository in this chat's visualization workspace. Browser emulation does not establish physical-device, screen-reader or live-attendee results.

## Production boundary and inherited conditions

The enabled local production preview serves the fictional page and a `private, no-store` discovery response. With `COMMUNITY_DEMO_ENABLED=false`, the page renders the not-found UI without fictional member content; the APIs return 404. Next 14's streamed not-found page can have HTTP 200 after its loading boundary has started, so page HTTP status alone is not the gating assertion. Live GitHub import returns 403 in production even when the fictional demo is enabled.

The optimized build succeeds. Without configured Notion credentials, the existing `/api/projects` source logs an authorization error and uses its existing empty-project fallback. Standalone TypeScript checking passes. Existing root 3D asset preloads produce browser warnings about credentials/preload use; they are inherited from the root layout. Homepage and `/timer` HTTP smoke checks return 200. The synthetic 503 test intentionally creates one failed-network console entry; fresh successful discovery runs have no console errors.

Do not run the development server and build against the same `.next` directory concurrently. A first overlapping attempt stalled; stopping the server and rebuilding from a clean generated directory succeeded. No application workaround or production configuration change was introduced for that local artifact conflict.

## What this does not establish

- No real member identity, account ownership, attendance, publication consent, host approval, messaging or data deletion has been verified.
- The live GitHub adapter was exercised with fictional API-shaped responses, not real people's profiles. The sample is offline. GitHub-shaped metadata suggests interests and a project draft, not skill, availability or willingness.
- No semantic embeddings, LLM, vector database, analytics service, persistent member database or Project Garden integration was added.
- The retrieval vocabulary is bounded. Richer language should be evaluated with member-written queries and graded results before adding model-based retrieval. Unknown constraints currently favor omission over a misleading introduction.
- No claim about adoption, useful conversations or new collaborations follows from this prototype.

## Recommended next experiment

Host a small 8–12-person consenting pilot during a social break after the real auth/consent/check-in boundary is implemented. Compare three explained introductions plus Ask/Offer with host-only introductions. Track whether a hello happened and whether it was worthwhile, plus false/awkward suggestions, correction effort, opt-outs and participation across disciplines. Add optional Project Garden updates before broad external enrichment; give artists, writers and offline creators the same useful starting point.
