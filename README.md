# James New System

Frontend application for the new system UI.

## Quick Start

```bash
npm install
npm run dev
```

Default local URL:
- `http://localhost:8080/james-newsystem/`

Run frontend + API together using shared env config:

```bash
/Volumes/ORICO/james-system/start-dev.sh
```

Single source config file for API URL/ports:
- `/Volumes/ORICO/james-system/.env.shared`

## Ubuntu setup and updates

`setup.sh` automatically applies required API migrations `014`–`018` on install,
update, production setup, and production update, before building/deploying the app.
Migrations `017` and `018` create the customer-request and recovery tables with
`CREATE TABLE IF NOT EXISTS`, so rerunning them preserves existing records.
Missing files or migration failures stop setup. `restart` does not run migrations.

For an existing installation, pull the latest script **before** launching it:

```bash
git pull --ff-only origin main
./setup.sh update
```

Run these from the frontend checkout on the Ubuntu server, using the same
`INSTALL_DIR` and `DB_*` environment values as the existing deployment. Setup
rewrites environment files; do not rely on its defaults for a custom database.
For production deployments, use `./setup.sh -productionupdate` instead; that mode
applies migrations and deploys files but leaves service restarts to the operator.
Pulling first is required because an older running script retains its old migration
function even when it updates the repositories during execution.

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
- Runtime services use the local API; Supabase migrations/functions remain as archive material.
- Some legacy-only features still need backend migration. See [repair and verification status](docs/supabase-removal-repair.md) before treating the removal as complete.
