# You Should Meet Implementation Plan

> For agentic workers: implement natively in this local branch; review the whole change with a fresh reviewer after the vertical slice works. The user's explicit autonomous instruction supersedes design approval pauses.

**Goal:** A beautiful local discovery experience with fictional, consented members, grounded recommendations/search, and a reviewable import draft.

**Architecture:** Extend this Next.js application at `/meet`. Pure TypeScript matching and eligibility, a demo-gated no-store API, source adapters, and a client UI with validated browser-only state.

**Tech Stack:** Existing Next 14, React 18, TypeScript, Zod, Radix Dialog, local fonts; Node 22 native TypeScript tests. No new dependencies.

**Spec:** `docs/community-discovery.md`, and the full user brief attached to this chat.

## Global Constraints

- Separate local branch only; no push or deployment.
- Fictional data; no attendee ingestion or external messages.
- Visibility filtering before retrieval and serialization.
- Source consent, review, revocation/reset, provenance; no sensitive-attribute matching.
- No new paid service or infrastructure. Existing homepage gains only the discovery entry point.

## Review Focus

- A private/draft/withdrawn or wrong-session member is queried directly: never returned.
- Skills, interests, and imported suggestions are different facts: explanations must preserve that distinction.
- A stale asynchronous search or corrupt local storage must not show the wrong results or crash.
- A GitHub-shaped payload contains redirects, private/forked repositories, oversized text, hostile URLs, or misleading metadata: safely bounded and review-only.
- A phone/keyboard/reduced-motion user must complete discovery and profile editing, including no-results/errors and reset.

## Task 1 — Domain and relevance

Files: `lib/community/{types,fixtures,search,discovery,schemas}.ts`, `tests/community/discovery.test.ts`.

Produces `discover(members, viewer, options): DiscoveryResult`, explicit public DTOs, and query/evidence contracts.

- [x] Write failing tests for visibility, check-in, focus, self, known meetings, search intent, campus, historic projects, sensible complementary ranking, evidence and diversity.
- [x] Implement pure eligibility/retrieval/ranking functions and fictional fixtures.
- [x] Run the focused suite and record relevance outcomes.

## Task 2 — Imports and request boundaries

Files: `lib/community/{imports,http}.ts`, `app/api/community/{discover,import}/route.ts`, `tests/community/{imports,http}.test.ts`.

Consumes the domain DTOs; produces validated no-store endpoints and `ProfileDraft` from a `ProfileSourceAdapter`.

- [x] Write failing tests for consent, profile draft semantics, fixed-host URL handling, limits, private/fork filtering, errors, and production gates.
- [x] Implement sample and opt-in local public GitHub adapters, request validation and bounded body parsing.
- [x] Verify real handler responses locally without real personal data.

## Task 3 — Sundays experience

Files: `app/meet/{page,loading,error}.tsx`, `components/community/{DiscoveryExperience,MemberDialog,ProfileEditor}.tsx`, `lib/community/browser-state.ts`, `styles/community.css`, `components/NavBar.tsx`.

Consumes only public discovery responses and the fictional viewer seed. Produces `/meet` with scope/search/surprise, useful profile context, local meeting feedback, editable reviewed profile drafts, visibility controls and reset.

- [x] Build the three-introduction default, search + scope + surprise, and accessible Radix dialogs.
- [x] Implement offline sample import, selected fact review, private/focus choices and local reset.
- [x] Check keyboard, loading, empty/error, stale requests, browser persistence and all three viewport classes.

## Task 4 — Evaluation and handoff

Files: package scripts, README, `docs/community-evaluation.md`.

- [x] Run all tests, standalone typecheck and production build.
- [x] Browser-check a full discovery → profile → conversation → marked-met path and import → edit → save → reset path.
- [x] Exercise API visibility/permission boundaries and production default-off behavior.
- [x] Fresh whole-change review, fix material findings, rerun affected checks.
- [x] Record synthetic evidence, remaining integration gates and exact local run instructions. Leave branch local.
