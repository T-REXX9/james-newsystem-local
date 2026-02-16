# James New System

Frontend application for the new system UI.

## Quick Start

```bash
npm install
npm run dev
```

Default local URL:
- `http://localhost:5173/james-newsystem/`

Run frontend + API together using shared env config:

```bash
/Volumes/ORICO/james-system/start-dev.sh
```

Single source config file for API URL/ports:
- `/Volumes/ORICO/james-system/.env.shared`

## Project Layout

- `components/` UI screens, feature views, and reusable UI parts
- `services/` data-access and business logic (API/Supabase/realtime services)
- `hooks/` custom React hooks
- `utils/` utility helpers and shared client logic
- `lib/` client setup and generated/shared library types
- `data/` local/static seed data used by UI
- `docs/` implementation notes, migration notes, and technical references
- `md files/root-archive/` legacy root markdown/text files archived for cleanup
- `scripts/` maintenance and seed scripts
- `supabase/` legacy Supabase migrations/functions kept for reference and phased migration
- `references/` source requirement and planning references
- `conductor/` internal process/product docs

## Testing and Build

```bash
npm test -- --run
npm run build
```

## Organization Rules

- Put new feature UI in `components/`.
- Put API integration logic in `services/`.
- Keep one-off notes under `docs/` instead of the repo root.
- Avoid adding generated outputs to Git (`dist/`, `node_modules/`, env files are ignored).
- Avoid macOS metadata files (`._*` and `.DS_Store`) in commits.

## Current Integration Direction

- Daily Call Monitoring now reads from local MySQL API endpoints.
- Supabase code remains in the repo for modules not yet migrated.
