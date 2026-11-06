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
mobile/   @quilt/mobile: the phone app, plain JavaScript without three.js, wrapped by Capacitor (android/, ios/);
          mobile/README.md has what's left to run it on a phone
```

One `npm install` at the top. The built app is `app/quilt.html` (one file, three.js from a CDN via import map);
`app/standalone.py` makes a fully self-contained copy. The owner also has it published as a claude.ai artifact.

## Commands (top folder unless noted)

```
npm run build              # app/src -> app/dist/app.js -> app/quilt.html (app/build.py, via app/tools/python.mjs)
npm run check              # prettier check, eslint, tsc (JSDoc types), unit tests of shared, app, server
npm run test:e2e           # Playwright browser tests of the app (build first; ~5 min; workers: 1), then the phone app's
npm run dev -w @quilt/mobile         # the phone app on :8200, in a browser, with quilts from the live API
npm run coverage:e2e -w @quilt/app   # browser-test coverage -> app/coverage/e2e/index.html
npm run dev -w @quilt/server         # API on :8787 (needs server/.env, see server/.env.example)
npm run seed -w @quilt/server        # dev only: 400 made-up + 100 museum fabrics for user "seed" (sync as "seed")
node app/tools/record-clips.mjs      # re-records the welcome cards' clips (app/assets/clips) from the real app; build first; needs ffmpeg, pdftoppm
.\deploy.bat                         # Windows (runs deploy.ps1): the API, then the page, online (-DryRun: only checks)
.\local.bat                          # Windows: the app on this computer (latest main, Docker, API :8787, page :8000)
.\local-stop.bat                     # Windows: turns it all off again (Docker stopped, its data kept)
node app/tools/record-clips.mjs tutorial   # re-records the first-quilt tutorial's clips, in both languages, with the logo (CLIP_ONLY=sash,fabric: just those)
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
  `core/symmetry`, `core/store`, `core/dom`, `core/quilt-sig`, `core/colour-match`, `cutting/plan`, `render/relief`, `storage/*` except
  boot, the `*-state.js` modules, `ui/notice`. Keep them pure; unit tests import them directly.
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
- **Realistic picture** (`sim/picture.js`, button and card `sim/picture-ui.js`, room `sim/bedroom.js`, fine quilt
  `sim/quilt-hero.js` + pure `render/relief.js`): made in the background on the person's own computer, with its own
  copy of the physics and its own hidden WebGL context, from the design as it was when asked for; the live view and the
  Photo render don't use any of this. Pictures are kept by the quilt's fingerprint (`core/quilt-sig.js`) in their own
  IndexedDB database (`storage/pictures.js`), never synced; sharing a quilt sends its picture, or makes one and sends it
  when ready (`mine/community.js`). The page must stay open. Don't call `getProgramInfoLog` for the path tracer: three's
  shader check (`renderer.debug.checkShaderErrors`) holds the whole page up for ~15 s, hence off on the picture's renderer.
- **The first-quilt tutorial** (`tour/tour.js`, offered once, when the first page closes): a real nine-patch quilt, from
  a new quilt's one row to 3 × 3, in inches, with its block size, sashing (tried at other widths, to see the quilt
  change) and a border, with a button to go back a step. A step that names a tile (`pick`) refuses the others, says
  so and shows its video again; it teaches saving, and finishing keeps the inches. A step's short video (`assets/clips/tut_<en|pt>_<clip>.mp4`, loaded only then) plays once in
  the card, and the sign lights the real button as it ends; every step is checked in the real app, and the button
  works during the video. No video that loads: straight to the sign. A step's controls or look changing means
  re-recording its clips. Screen and logo only, no voice, and not on phones (`IS_PHONE`: no tutorial).
- **Page security**: `build.py` puts each CDN library's fingerprint in the import map (`tools/import-integrity.mjs`,
  from the same versions in node_modules, so template.html and package.json must agree) and writes `app/dist/_headers`,
  the host's security headers. Scripts run only by their fingerprint or from those packages, so no inline event
  attributes (`onclick="…"`), `eval`, or new CDN packages without the map. The browser tests run under this policy.
  Sign-in tokens only go to `API_URL` or this computer.
- **The published page**: `npm run publish:page -w @quilt/app` makes `app/publish/` (the page as `index.html`, assets,
  `_headers`) and fills in `core/build-settings.js` (`API_URL`, `SENTRY_DSN`, the version); in `quilt.html` they stay
  empty: no server online, no error reports. Sentry's library loads only on the published page, by its fingerprint
  (`ui/error-reports.js`: a new version needs a new one). What leaves goes through `shared/src/scrub-report.js`, which
  keeps a short list of safe fields: quilts, names, emails, tokens and photo links must never get into a report.
- **The phone app** (`mobile/`) shares with the web app through `@quilt/shared`, including how a quilt is painted
  (`quilt-paint.js`, told how to find a fabric) and the basic fabrics (`basic-fabrics.js`), and uses the web's pure
  `storage/repo.js` and `storage/sync.js`. It must stay free of three.js and of `app/src` modules with side effects; its
  text goes through `t()` and the same dictionary (`pt-BR/phone.js`). What only it keeps (folders, notes, quilt photos,
  colours) is in its own database (`mobile/src/store.js`); folders show in the web library as groups
  (`designer/fabric-folders-state.js`). `build.mjs --dev-signin` makes the tests' build, which signs in by name; the
  scripts that make a real app don't use it. The page allows scripts only from itself, so Auth0's library is bundled.
- **Style**: Prettier (120 cols, single quotes). Comments say why in plain words. UI text is short and friendly.

## Server (server/)

- Fastify; request bodies validated by JSON schema (unknown fields refused); errors `{ error, message }`.
- Tables (migrations/): users, designs (PK owner_id + id, `doc` jsonb), fabrics (PK owner_id + id), shared_designs
  (with its realistic picture's `picture_key`, dropped when a changed quilt is shared).
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
  The stand-in login only runs when `AUTH_MODE=dev` is set by name; without it the server takes Auth0 tokens or
  nobody. Production refuses `AUTH_MODE=dev` and `STORAGE=local`. Migration 001 has not been deployed anywhere yet, so it can still be edited; after the first
  deployment, add new migration files instead.
- `npm run smoke -w @quilt/server` checks a running server end to end.
- **Limits** (`config.js`, `server/.env.example`): requests a minute (`@fastify/rate-limit`: per person, per address
  before sign-in; fewer for uploads, sharing and the public list), photos, designs and shared quilts per account, shared
  quilt size, bytes in a Community page. On a host's proxy set `CLIENT_IP_HEADER` (Fly.io: `fly-client-ip`).
- **Community moderation**: `POST /v1/community/:id/report`; three different people hide a quilt until
  `npm run moderate -w @quilt/server` (list, hide, show, block, unblock) settles it. A hidden quilt can't be re-shared.
- The server reads quilts with `read-quilt.js`, never `readDesign` directly: it forgets their drawn blocks afterwards.
- **Backups** (`scripts/backup.sh`, `restore.sh`, `.github/workflows/backup.yml`): encrypted nightly copies of the
  database in their own bucket, off until the repository variable `BACKUPS_ON` is `true`. Photos are not in them.
- `/alive` is the host's check and never touches the database (Neon is paid by the hour, and has to be left to sleep);
  `/health` does, for an uptime monitor asking every few minutes. Unexpected errors go to `error-reports.js`.

## Where things stand

Done, in order: module split → tooling and tests → pure edits through dispatch → store modules, one undo step
per edit → versioned format → IndexedDB → coverage and more tests → server (steps 1–4, 6) → app sync (step 7).

**The app is live** (step 8): the page at https://block-and-bind.pages.dev (Cloudflare Pages) and the API at
https://block-and-bind-api.fly.dev (Fly.io, São Paulo), with Neon for the database, Cloudflare R2 for photos and backups,
and Sentry for error reports; `server/README.md`, "Going live", has the steps. Merging to `main` doesn't update them: the
page is republished with `publish:page` and the API deployed from `fly.toml`, both by `deploy.ps1`. The published page on claude.ai
may not be able to use Auth0's sign-in popup from inside claude.ai's frame: untested.

**Next: the phone app on a real phone.** Built and tested in a browser: Community, My quiltings, My fabrics with folders, and
a camera for photos of quilts and fabrics. Designs are view-only there; the web app stays the place to design. It has never
run on a device: the camera, sign-in through the phone's browser and the Android back button are untested, and
`mobile/README.md` lists what the owner must set up first (Android Studio, CORS, R2, Auth0, deploying migration 005). The
privacy policy and terms are drafts, and deleting an account doesn't yet remove the sign-in at Auth0.

**Known gaps / ideas**
- Plans on the welcome page: Block (free) and Bind ("Coming soon", no price or button). Nothing takes payments yet, so
  a free account still has sync and Community sharing, and the card says so. Charging for Bind needs a payment
  provider, the owner's prices, and a decision on what happens to free accounts' synced designs.
- The welcome page no longer offers "Continue without an account" (the owner's choice): a new visitor must sign in,
  which needs Auth0 and the API online. People who skipped earlier keep their `quilt-welcome.v1` and go straight in.
- The makers' row on the welcome page (`BRANDS` in `mine/account.js`) shows logos taken from the makers' own websites
  (`app/assets/brands`). No permission has been asked for yet, and the app's 1500 fabrics are drawn by code, not those
  makers' fabrics: the heading and the logos need real fabrics and the makers' permission before the page goes public.
- Block editor: drawn blocks can't be deleted from My blocks yet; drawing needs a pointer (no keyboard way).
- Adding fabric photos: the "+ Add fabric" tile (`designer/add-fabric.js`), first in every fabric list and in the
  fabric library, takes files from the computer. The webcam fabric feature was removed at the owner's request: don't
  bring it back to the web app. A camera belongs only in the phone app.
- Photos added on a plain-http page get the simple `h…` fingerprint and are not synced (sync says so).
- Undo timelines are all loaded into memory at start; load per design if people have hundreds of designs.
- Later: "fabrics like this one" with pgvector (image embeddings in a background job) and dominant-colour palettes.
- Parked by the owner: tests for the photo render, the 3D camera/controls and the guided tour.

## Commits

Small, descriptive messages. Never commit `server/.env`, screenshots, PDFs or logs (see .gitignore).
