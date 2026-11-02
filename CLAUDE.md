# Block & Bind: notes for Claude

A quilt designer in the browser: design a quilt block by block, get its cutting guide and an A4 PDF with
real-size templates, and see it draped on a bed or table in 3D. The app works on its own (IndexedDB); an
optional server syncs saved quilts and fabric photos between a person's devices.

The app's name is **Block & Bind**. "Quilt designer" stays as the name of the design tab. The internal names
(`quilt-designer.*` storage keys, the Auth0 API identifier, the folder and packages) stayed on purpose.

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
npm run build              # app/src -> app/dist/app.js -> app/quilt.html (app/build.py, via app/tools/python.mjs)
npm run check              # prettier check, eslint, tsc (JSDoc types), unit tests of shared, app, server
npm run test:e2e           # Playwright browser tests of the app (build first; ~5 min; workers: 1)
npm run coverage:e2e -w @quilt/app   # browser-test coverage -> app/coverage/e2e/index.html
npm run dev -w @quilt/server         # API on :8787 (needs server/.env, see server/.env.example)
npm run seed -w @quilt/server        # dev only: 400 made-up + 100 museum fabrics for user "seed" (sync as "seed")
node app/tools/record-clips.mjs      # re-records the welcome cards' clips (app/assets/clips) from the real app; build first; needs ffmpeg, pdftoppm
```

Server tests and `app/tests/e2e/sync.spec.mjs` need PostgreSQL: `TEST_DATABASE_URL` (default
`postgres://postgres@localhost:5433/postgres?host=/tmp`). With docker compose:
`TEST_DATABASE_URL=postgres://quilt:quilt@localhost:5432/postgres`. sync.spec skips itself without a database.

Everything must stay green: `npm run check` with zero lint warnings, and all browser tests. GitHub runs the same
checks on every pull request and every change to main (`.github/workflows/ci.yml`), and also that the committed
`app/quilt.html` is the build of the code next to it.

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
- **Drawn blocks** (`shared/src/drawn-blocks.js`, editor `designer/block-drawer.js`, drawing model `core/cell-drawing.js`):
  a quilt carries the blocks drawn in the block editor in `design.drawn`, keyed `my` + a hash of the drawing (grid
  notation of `grid-blocks.js`); `readDesign` checks them and registers them as patterns (family "My blocks"). A
  changed drawing is a new key; the library gathers My blocks from every saved quilt. Graph-paper blocks
  (`core/paper-drawing.js`) have every cell "x" and their pieces in `extra`, found from the seam lines by
  `shared/src/seam-faces.js`; the lines and fills are kept in `paper` to open them again.
- **Storage** (`storage/repo.js`, `createRepo()`): IndexedDB stores designs, fabrics (photos as Blobs, id =
  `f` + sha-256), timelines (undo, device only), session. Read into memory at start; writes batched right after.
  Records have `rev` (local saves), `syncRev` (server rev it's based on), `dirty`, `deleted` markers.
  Records carry `owner` (the account: Auth0 sub or `dev:<name>`; none = made while signed out): only the signed-in
  account's and owner-less ones are listed, only the account's own are synced; signing in offers the owner-less
  ones (not the samples), signing out hides the account's and opens a new design.
  Small per-device preferences stay in localStorage.
- **Sync** (`storage/sync.js` engine, `mine/sync-ui.js` card on My designs): push photos, push designs, pull
  `/v1/changes`. Conflict = server version keeps the id, this device's becomes "Name (this device)". Triggers:
  2.5 s after a local change, on `online`, every minute, "Sync now".
- **Language** (`shared/src/i18n.js`, dictionary `shared/src/lang/pt-BR/`): English stays in the code and is the key.
  New text: `t('Sign in')`, `t('Block {n} of {all}', { n, all })`, `tn(n, '{n} block', '{n} blocks')`; always a plain
  literal and a whole sentence (word order differs), `fix(v, 2)` for decimals a person reads, `unitName()` for the unit.
  `template.html` stays in English (`ui/translate-page.js` looks its text up). Then add the Portuguese to the part of
  the dictionary for that area; `node app/tools/i18n-strings.mjs missing` lists what is missing, and the unit tests
  fail until it is there. A new block needs its name in `pt-BR/blocks.js` (the English again if quilters keep it), a new
  piece name the parts in `pt-BR/pieces.js`. The language is fixed at page load (the menu saves it in localStorage and
  reloads), so `t()` works in module-level constants. Saved quilts don't depend on it: piece names stay English in
  `design.drawn` and are translated when read (`partsOf`); `PATTERNS[k].family` stays English for the code (`t(family)`
  to show it). Node always starts in English, and the browser tests run in English except `i18n.spec.mjs`.
- **Style**: Prettier (120 cols, single quotes). Comments say why in plain words. UI text is short and friendly.

## Server (server/)

- Fastify; request bodies validated by JSON schema (unknown fields refused); errors `{ error, message }`.
- Tables (migrations/001_init.sql): users, designs (PK owner_id + id, `doc` jsonb), fabrics (PK owner_id + id).
  `rev` per record (409 on a stale baseRev), `seq` from one sequence per write, each user's writes serialized by
  `lockOwner` so sync by `seq` never misses a change. Deleted rows stay as markers.
- Photos: signed upload link to a fresh `uploads/...` key, then `done` re-hashes and copies to `fabrics/...`.
  Storage: S3/R2/SeaweedFS (`objects.js s3Store`), or `STORAGE=local` (folder served by the API, dev only).
  Docker compose runs SeaweedFS (port 8333) because MinIO stopped publishing its images.
- Login: **Auth0** (the owner's choice; tenant `dev-5op4uervqyekvlsx.us.auth0.com`, API identifier
  `https://api.quilt-designer`). The app (`storage/auth0.js`) loads Auth0's library from the CDN only on sign-in,
  signs in in a popup, keeps refresh tokens in localStorage, and the sync sends `Authorization: Bearer`; the
  server (`auth.js`, jose) checks issuer, audience, RS256 signature and expiry, and maps `sub` to users.auth_sub.
  Tests never reach Auth0: they sign tokens with their own key (`buildApp({ keys })`), and the browser tests
  serve a stand-in for the library. `AUTH_MODE=dev` also takes the `X-Dev-User` header (tests, the `seed` user).
  Production refuses `AUTH_MODE=dev` and `STORAGE=local`. Migration 001 has not been deployed anywhere yet, so it can still be edited; after the first
  deployment, add new migration files instead.
- `npm run smoke -w @quilt/server` checks a running server end to end.

## Where things stand

Done, in order: module split → tooling and tests → pure edits through dispatch → store modules, one undo step
per edit → versioned format → IndexedDB → coverage and more tests → server (steps 1–4, 6) → app sync (step 7).

**Next: step 8, going live.** Deploy the API (one Node instance on Fly or Render), managed PostgreSQL with
backups (Neon, Supabase or Render), Cloudflare R2 for photos behind a CDN, error logging. Login is done (Auth0,
above); going live needs the app's real address added in Auth0 (Allowed Callback URLs and Web Origins: the
origin; Allowed Logout URLs: the page itself, since Sign out goes through Auth0's logout and comes back to it).
The owner hasn't chosen the host yet: ask. The published page on claude.ai can only sync once the API is on https
on the internet (Chrome blocks pages from reaching a server on the person's own computer), and Auth0's sign-in
popup may not open from inside claude.ai's frame: untested.

**Known gaps / ideas**
- Plans on the welcome page: Block (free) and Bind ("Coming soon", no price or button). Nothing takes payments yet, so
  a free account still has sync and Community sharing, and the card says so. Charging for Bind needs a payment
  provider, the owner's prices, and a decision on what happens to free accounts' synced designs.
- The welcome page no longer offers "Continue without an account" (the owner's choice): a new visitor must sign in,
  which needs Auth0 and the API online. People who skipped earlier keep their `quilt-welcome.v1` and go straight in.
- Block editor: drawn blocks can't be deleted from My blocks yet; drawing needs a pointer (no keyboard way).
- The "Add fabric photos" button sits in a section that is always hidden, so people can't add their own fabrics
  (tests reach it through the code). Proposed: a "+ Add fabric" tile at the end of the fabric list (photo file).
  Not done yet: ask first. The webcam fabric feature was removed at the owner's request: don't bring it back.
- Photos added on a plain-http page get the simple `h…` fingerprint and are not synced (sync says so).
- Undo timelines are all loaded into memory at start; load per design if people have hundreds of designs.
- Later: "fabrics like this one" with pgvector (image embeddings in a background job) and dominant-colour palettes.
- Parked by the owner: tests for the photo render, the 3D camera/controls and the guided tour.

## Commits

Small, descriptive messages. Never commit `server/.env`, screenshots, PDFs or logs (see .gitignore).
