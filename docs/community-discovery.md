# You Should Meet — local evaluation

Built on local branch `codex/you-should-meet`, from main at `6702789`. This extends the existing Next.js application at `/meet`. No deployment, attendee ingestion, messages, or paid services are authorized by this experiment.

## Product decision

Lead with three useful introductions at a social break. Each contains a specific connection, the person's current project, and a conversation starter. Search is a secondary route when someone already has a question. A different-practice suggestion is useful only when there is a real bridge; novelty alone does not justify a recommendation.

Use fictional members throughout this experiment. At the user's request, the evaluation interface uses concise product copy without preview labels or repeated prototype explanations; the fictional-data and local-only boundaries remain documented here. Attendance means checked in for this demo session, not merely RSVP'd. Broader discovery requires a separate community visibility choice. Focus mode removes a person from proactive introductions. Profile drafts remain private until explicitly reviewed. The prototype does not publish to a real community.

## Existing capabilities and constraints

The checkout has Next 14 / React 18, TypeScript, Tailwind, local Office Times / Monument / Editorial fonts, Framer Motion, Radix Dialog, Zod, and read-only Notion projects. It has no membership portal, authentication, attendee database, member profile storage, or Project Garden implementation. Luma is an outbound link. Existing host/project information is not discovery consent and is not reused as member data.

Reuse the warm paper, chrome smiley, dashed guides, editorial typography, lime marks, purple details, and quiet motion. The new page uses a small stack of personal introduction notes, rather than a ranked talent directory. The signature is the folded corner and marginal connection annotation on each introduction. All actions work at phone/tablet/desktop widths and by keyboard; motion respects reduced-motion.

## Enrichment research and recommendation

| Input | Value / cost | Permission and accuracy | Decision |
| --- | --- | --- | --- |
| Today's project + Ask / Offer | Highest temporal relevance; no API cost; very little maintenance | Member-written, individually editable; works for people with no online presence | Required core, three short fields |
| Sundays project/demo updates | Rich longitudinal context, no external API spend | Requires explicit per-member discovery permission and project authorship; current Notion participation is insufficient | Best next source; `origin` + project ID form the future Project Garden seam |
| Personal portfolio | Useful across disciplines; variable extraction and hosting cost | Owner-provided source permission, site terms/robots, bounded fetches, SSRF protections, stale pages; extraction creates reviewable claims, never facts about willingness | Add after the pilot; begin with one supplied page or pasted text, not broad crawling |
| GitHub public API | Useful for technical projects; no paid enrichment service needed | Public profile/repository endpoints; unauthenticated primary limit 60 requests/hour per IP, normally 5,000/hour authenticated; code/language metadata does not establish expertise | Implement a fixture adapter plus a disabled-by-default public API adapter. Two bounded requests, no private repos, email, followers, stars, or code analysis |
| LinkedIn official API | Good for sign-in/basic identity; poor default for rich enrichment | Self-service OIDC returns basic profile claims, not an unrestricted skills/work-history dossier. Other programs need approval | Defer rich import; allow a member-authored summary or link later. No scraping |
| Other creator sources | A portfolio/project URL or pasted description can cover film, writing, music, craft | Availability and authorization vary; don't make online footprint a quality signal | Keep the source adapter contract, prioritize creator-owned input |
| AI-generated drafts | Can reduce writing effort; adds provider cost and hallucination/privacy surface | Treat source text as untrusted data; preserve provenance; selected claims require review; no sensitive inference | Deterministic extraction in this slice. Evaluate an LLM draft against factuality/correction rate before adding it |

Primary sources checked November 4, 2026:

- [GitHub public profiles](https://docs.github.com/en/rest/users/users#get-a-user) and [public repositories](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user).
- [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
- [LinkedIn OIDC scopes and claims](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) and [API access programs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access).
- [Luma API access](https://docs.luma.com/reference/getting-started-with-your-api): Plus subscription and calendar-scoped admin key. No subscription is purchased. [Guest CSV](https://help.luma.com/p/download-guest-csv) is an eventual host-controlled alternative; importing a guest never implies discovery consent.

Recommended combination: tiny Ask/Offer/current-project onboarding → optional permitted source draft → individual review → separate session/community visibility → voluntary weekly changes. This serves artists and members without public profiles equally. GitHub is a convenient optional adapter, not the product's default definition of a person.

## Architecture and invariants

- Pure TypeScript domain functions filter eligibility before search/ranking and before serialization. A candidate needs reviewed opt-in; today's scope additionally requires check-in to the exact session; community scope requires community visibility. Self is excluded. No private/draft/withdrawn profile is returned, even if directly queried.
- Search combines phrase/concept aliases with weighted lexical evidence across member-approved interests, offers, asks, and project context. Campus and historical-project requests are explicit filters; recognized topics never discard remaining meaningful terms. Capability questions do not promote an interest into a skill. Help requests require an explicit offer. Specific tools such as React, TypeScript and Swift, and precise capabilities such as machine learning, require literal evidence rather than a broad web/mobile/AI alias. Different-practice requests preserve other constraints. Unsupported or sensitive-trait queries return a useful empty state. This is a bounded natural-language prototype, not an embedding model or LLM; it does not implement unrestricted conversational understanding, negation, or arbitrary Boolean queries.
- Matching weighs candidate offers answering viewer asks (30 each), viewer offers answering candidate asks (20 each), current-project relevance (8 per concept; historical projects receive 2), shared interests (4 each), and a different-practice bridge (5). Prior meetings remove proactive suggestions but remain searchable. A diversity pass can include a different practice when it has an evidenced bridge. No scores, popularity, follower counts, or sensitive traits appear in the product.
- Reasons are templates filled only from actual profile fields. Every reason includes the evidence field and exact excerpt. Import-derived interests are never silently converted into offers. No shared interest means no invented shared interest.
- `/api/community/discover` is a bounded, validated, no-store POST. The server owns the fictional candidate set. A supplied viewer is only a local demo perspective, not authenticated identity. The demo is disabled in production unless explicitly enabled. A real launch must replace the viewer input with authenticated identity and enforce access on every read.
- GitHub import is fixed-host, explicitly opted in, time/size bounded, redirect refusing, and drafts only. Sample mode is fully offline. Live mode requires a separate local environment flag and is always disabled in production. The adapter can be tested with captured fictional API-shaped data.
- Browser storage is validated/versioned. It contains only the edited demo perspective, local meetings/feedback, and selected source claims. Imported projects independently retain the source URL, label, fetch time and original title/summary even after edits. Consent/source/username changes and closing the editor invalidate pending imports; search also cancels stale requests. Reset removes local data. No tracking or host messages are sent.

## Integration and later production requirements

Member, attendance, project, source-claim, and introduction-feedback ownership must be separated. A small relational database is enough for a real pilot; add full-text and optionally pgvector only after relevance evaluation demonstrates a need. No graph database, vector service, or paid enrichment service is introduced here.

Before real use: member authentication, server-side membership authorization, separate discovery/source/publication consent records, a real session/check-in adapter, encrypted provider tokens, durable deletion/revocation (including derived claims and indexes), limits and audit logs, retention rules, host-approved copy and a small consenting pilot. Project Garden must pass explicit owner/review/visibility metadata with projects; joining authors by name is insufficient.

## Pilot and success criteria

Start at a social break with 8–12 consenting volunteers. Offer three suggestions and an Ask/Offer card; observe whether people actually initiate a conversation. Invite optional, private feedback: did you meet, was it worthwhile, would you meet again? Ask hosts about useful introductions and burden. Measure first introduction and useful-conversation rate, missed/incorrect suggestions, profile correction and withdrawal friction, and participation across creative disciplines. Browsing time and clicks are not success.

Open hypotheses: before-event demand, willingness to import, value over a host's memory, and whether search adds enough beyond three suggestions. Test these in the pilot; a polished prototype does not establish product adoption.

## Local evaluation

`npm run dev`, then visit `http://localhost:4000/meet`. All seeded people and projects are fictional. `npm test` covers domain, import and request boundaries. `npm run typecheck` checks TypeScript independently of the existing build's ignore-errors setting. `npm run build` checks integration. For production-mode local QA only, set `COMMUNITY_DEMO_ENABLED=true` for build/start. Real GitHub reads additionally need `COMMUNITY_GITHUB_IMPORT_ENABLED=true` in development and per-import source consent; no token is required for the limited public endpoint. Do not use that self-asserted consent flow as verified account ownership in a real release.

Implementation and evidence are tracked in the accompanying plan and evaluation notes. Browser emulation is not physical-device or live-attendee evidence.
