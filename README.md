# README
This is the Sundays in LA website.

## Run locally

Use Node 22.18 or newer (the community tests use native TypeScript support).

```sh
npm install
npm run dev
```

Open http://localhost:4000. The local **You Should Meet** experiment is at http://localhost:4000/meet and has a development-only navigation link. It uses entirely fictional members and projects; edits, introductions and feedback stay in this browser. No membership account or API key is needed to try the sample import.

```sh
npm test
npm run typecheck
npm run build
```

Stop the development server before building: both use Next's `.next` directory. The existing build skips type errors, so run the separate typecheck as well. The existing Notion project source needs its own local configuration; without it the homepage uses its existing empty-project fallback.

For a local production-mode preview:

```sh
COMMUNITY_DEMO_ENABLED=true npm run build
COMMUNITY_DEMO_ENABLED=true npm run start -- -p 4000
```

Production keeps discovery unavailable by default. The flag only exposes the fictional preview; it does not connect real members. Live public GitHub import is a separate development-only experiment behind `COMMUNITY_GITHUB_IMPORT_ENABLED=true` and per-source consent. It does not verify account ownership and is always disabled in production. Use the offline sample for evaluation without importing a real person's information.

See [product, research and architecture](docs/community-discovery.md), [evaluation evidence and limits](docs/community-evaluation.md), and the [implementation plan](docs/superpowers/plans/2026-11-04-you-should-meet.md).

The [Luma pilot](docs/luma-pilot.md) adds a private host panel at `/meet/pilot` and one-time member card claims. Use `npm run pilot:dev` with the local settings in the guide. The pilot is off by default and the command binds to loopback.

# Contributors:
- Sarah Fan
- Alan Song
- Michelle Liu
