# Quilt designer: notes for Claude

A quilt designer in the browser: design a quilt block by block, get its cutting guide and an A4 PDF with
real-size templates, and see it draped on a bed or table in 3D. The app works on its own (IndexedDB); an
optional server syncs saved quilts and fabric photos between a person's devices.

The owner is a quilter and engineer (Jackson, Brazil, UTC-3), not a full-time web developer. Explain choices
in plain words, ask before big structural changes, and keep the app working at every commit.

## Layout (npm workspaces)

```
app/      front end: plain JavaScript ES modules (no framework), three.js, cloth physics in a Web Worker
          src/README.md has the module map and the rules below in more detail
shared/   @quilt/shared: block patterns, quilt geometry (mm), the saved design format + checks (pure, Node + browser)
server/   @quilt/server: Fastify + PostgreSQL 16 (+pgvector) + S3/R2 photo storage; server/README.md
```

One `npm install` at the top. The built app is `app/quilt.html` (one file, three.js from a CDN via import map);
`app/standalone.py` makes a fully self-contained copy. The owner also has it published as a claude.ai artifact.

## Commands (top folder unless noted)

```
npm run build              # app/src -> app/dist/app.js -> app/quilt.html (python3 app/build.py)
npm run check              # prettier check, eslint, tsc (JSDoc types), unit tests of shared, app, server
npm run test:e2e           # Playwright browser tests of the app (build first; ~5 min; workers: 1)
npm run coverage:e2e -w @quilt/app   # browser-test coverage -> app/coverage/e2e/index.html
npm run dev -w @quilt/server         # API on :8787 (needs server/.env, see server/.env.example)
```

Server tests and `app/tests/e2e/sync.spec.mjs` need PostgreSQL: `TEST_DATABASE_URL` (default
`postgres://postgres@localhost:5433/postgres?host=/tmp`). With docker compose:
`TEST_DATABASE_URL=postgres://quilt:quilt@localhost:5432/postgres`. sync.spec skips itself without a database.

Everything must stay green: `npm run check` with zero lint warnings, and all browser tests.

## Rules of the front end (app/src)

- **Load order chain.** Each non-pure module's first import is the module that runs before it
  (`import './prev.js'; // load order: runs after x`); `main.js` imports the last. Keep that first line; use
  `node app/tools/chain.mjs list | insert <mod> after <prev> | unchain <mod>`. `storage/boot.js` is first: its
  top-level `await` loads IndexedDB before anything else runs.
- **Pure modules** (no side effects when loaded, importable in Node): `@quilt/shared/*`, `core/edits`,
  `core/symmetry`, `core/store`, `core/dom`, `cutting/plan`, `storage/*` except boot, the `*-state.js` modules,
  `ui/notice`. Keep them pure; unit tests import them directly.
- **Edits are pure functions** `(design, ...args) => newDesign` (core/edits.js, core/symmetry.js): never mutate,
  share unchanged blocks, return the same object when nothing changes. The UI applies them only through
  `dispatch(edit, ...args)` (designer/dispatch.js), which mirrors (symmetry), repairs large blocks, saves, records
  one undo step and redraws. Whole-design changes: `replaceDesign` / `openDesign`. `edit.mirror = false` skips
  mirroring; `edit.merge = true` merges quick repeats into one undo step. Browser tests deep-freeze the design
  (`quilt-freeze.v1`), so any in-place mutation throws.
- **State** lives in small pure modules with live-binding exports and setters (`core/store.js`: design,
  selection, mineCur, readOnly…; `designer/ui-state.js`, `render/hi-state.js`, `sim/sim-state.js`). Only
  `dispatch.js` sets the design.
- **Saved format** (`shared/src/format.js`): designs carry `v` (FORMAT_VERSION in shared/src/design.js). Every
  design that comes in goes through `readDesign` (upgrade via MIGRATIONS, check, repair with messages; newer
  versions are read-only). To change the format: bump the version, add one migration, add an example to
  `shared/tests/fixtures/designs/` (all of them are opened by the tests).
- **Storage** (`storage/repo.js`, `createRepo()`): IndexedDB stores designs, fabrics (photos as Blobs, id =
  `f` + sha-256), timelines (undo, device only), session. Read into memory at start; writes batched right after.
  Records have `rev` (local saves), `syncRev` (server rev it's based on), `dirty`, `deleted` markers.
  Small per-device preferences stay in localStorage.
- **Sync** (`storage/sync.js` engine, `mine/sync-ui.js` card on My designs): push photos, push designs, pull
  `/v1/changes`. Conflict = server version keeps the id, this device's becomes "Name (this device)". Triggers:
  2.5 s after a local change, on `online`, every minute, "Sync now".
- **Style**: Prettier (120 cols, single quotes). Comments say why in plain words. UI text is short and friendly.

## Server (server/)

- Fastify; request bodies validated by JSON schema (unknown fields refused); errors `{ error, message }`.
- Tables (migrations/001_init.sql): users, designs (PK owner_id + id, `doc` jsonb), fabrics (PK owner_id + id).
  `rev` per record (409 on a stale baseRev), `seq` from one sequence per write, each user's writes serialized by
  `lockOwner` so sync by `seq` never misses a change. Deleted rows stay as markers.
- Photos: signed upload link to a fresh `uploads/...` key, then `done` re-hashes and copies to `fabrics/...`.
  Storage: S3/R2/MinIO (`objects.js s3Store`), or `STORAGE=local` (folder served by the API, dev only).
- Login: **development stand-in only** (`X-Dev-User` header). Production refuses `AUTH_MODE=dev` and
  `STORAGE=local`. Migration 001 has not been deployed anywhere yet, so it can still be edited; after the first
  deployment, add new migration files instead.
- `npm run smoke -w @quilt/server` checks a running server end to end.

## Where things stand

Done, in order: module split → tooling and tests → pure edits through dispatch → store modules, one undo step
per edit → versioned format → IndexedDB → coverage and more tests → server (steps 1–4, 6) → app sync (step 7).

**Next: step 8, going live.** Deploy the API (one Node instance on Fly or Render), managed PostgreSQL with
backups (Neon, Supabase or Render), Cloudflare R2 for photos behind a CDN, error logging, and a **real login**
(hosted provider such as Clerk / Auth0 / Supabase Auth; the server verifies the provider's token via JWKS and
maps `sub` to users.auth_sub). The owner hasn't chosen the provider or host yet: ask. The published page on
claude.ai can only sync once the API is on https on the internet (Chrome blocks pages from reaching a server on
the person's own computer).

**Known gaps / ideas**
- The "Add fabric photos" and "Take a photo" buttons sit in sections that are always hidden, so people can't add
  their own fabrics (tests reach them through the code). Proposed: a "+ Add fabric" tile at the end of the
  fabric list (photo file or webcam). Not done yet: ask first.
- Photos added on a plain-http page get the simple `h…` fingerprint and are not synced (sync says so).
- Undo timelines are all loaded into memory at start; load per design if people have hundreds of designs.
- Later: "fabrics like this one" with pgvector (image embeddings in a background job) and dominant-colour palettes.
- Parked by the owner: tests for the photo render, the 3D camera/controls and the guided tour.

## Commits

Small, descriptive messages. Never commit `server/.env`, screenshots, PDFs or logs (see .gitignore).
