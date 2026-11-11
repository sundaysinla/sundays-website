# Luma to Sundays Pilot Implementation Plan

> For agentic workers: execute each boundary against a failing test first. Keep this on the current local branch.

**Goal:** Import consenting RSVPs for one Luma event as private, claimable cards, then let reviewed and checked-in members discover each other.

**Architecture:** A fixed-host, read-only Luma adapter validates the event and its opt-in question before reading paginated guests. A loopback pilot API uses a host session, one-time claim links, and a local SQLite store; member visibility and discovery are enforced on the server.

**Tech stack:** Existing Next 14, TypeScript, Zod, Node 22 SQLite, and the Sundays discovery matcher. No new service or package.

**Spec:** The agreed Luma form → private card → owner approval → check-in → introductions flow in this chat, extending `docs/community-discovery.md`.

- [x] Intake: fixture tests for absent/ambiguous consent, no roster fetch on an unready form, duplicate/multi-ticket guests, bounded pagination, and optional links. Implement fixed-host GETs and retain only authorized RSVP fields.
- [x] Local state: test exact-event ownership, independent publish/check-in gates, expiring one-use claims, refresh/revocation and contact-data minimization. Implement private store and authenticated, no-store API.
- [x] Host and member views: reuse Sundays styling and existing matcher/cards. Inspect a configured event; import sample RSVPs; give a guest their claim link; approve the card; show event introductions.
- [x] Verification: exercise live event metadata only until the form has the exact optional opt-in; complete the sample flow in the browser. Run tests, typecheck and build. Keep the key outside source and leave the live form untouched.

The November 22 event currently supplies the project question and lacks the explicit discovery checkbox. Do not read or persist its guests while that gate is missing. Use sample rows for the full evaluation. Host-issued claim links are the local substitute for verified email delivery.
