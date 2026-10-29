# Front end source

Plain JavaScript ES modules, bundled by esbuild into `dist/app.js`; `build.py` puts the bundle into `template.html`
to make `quilt.html`. The three.js libraries stay external: the page's import map loads them from the CDN.
The cloth physics (`../physics.js`) is a separate classic script; it runs in a Web Worker.

```
core/       dom helpers, block patterns, quilt geometry (mm), pure edits, the store (design + selection)
render/     drawing the quilt top, quilting lines, cutting-guide highlight
designer/   the Quilt designer: design state, canvas, side panels, symmetry, hover, settings
cutting/    cutting plan (pure), drawings and the Cutting guide page
pdf/        the A4 cutting-guide PDF and real-size templates
sim/        3D simulation: renderer, stage, bed/table, camera, quilt mesh, physics link, photo render, analysis
mine/       My designs and the sample designs
timeline/   undo / redo and the film strip
tour/       guided tour
camera/     new fabric from the webcam
storage/    IndexedDB: saved designs, fabric photos, undo timelines, the session (boot.js opens it first)
platform/   saving files
ui/         foldable cards
app/        pages, layout, animation loop, start-up
main.js     entry point
```

## Rules

- **Pure modules** (`core/patterns`, `core/geometry`, `core/symmetry`, `core/types`, `core/design`, `core/edits`,
  `core/format`, `core/dom`, `cutting/plan`, `ui/notice` and the state modules below) are not in the chain: they have no side effects when loaded and import nothing that is, so they
  can be imported anywhere, including the unit tests in Node. Keep them that way.
- **Load order.** Each other module's first import is the module before it (`import './previous.js'`), and `main.js`
  imports the last one. ES modules run depth-first and skip modules that are already loading, so the modules run
  in exactly the order the app was written in. Keep that first import when you add a module: put the new module
  in the chain where its top-level code has to run.
- **Edits are pure.** An edit is a function `(design, ...args) → new design` in `core/edits.js` (or
  `core/symmetry.js`): it never changes its input, shares the blocks it leaves alone, and returns the same object
  when nothing changes. The UI applies it with `dispatch(edit, ...args)` (`designer/dispatch.js`), which mirrors
  the changed blocks, repairs large blocks, saves, records one timeline step and redraws. Whole-design changes
  (new, open, undo, cancel) go through `replaceDesign`. `edit.mirror = false` skips mirroring;
  `edit.merge = true` makes quick repeats (typing a size, a held stepper) one timeline step.
- **State.** ES module imports are read-only but live: a module sees the current value of an exported `let`.
  State used by several modules lives in small pure state modules — `core/store.js` (the design, the selection,
  the active fabric), `designer/ui-state.js`, `render/hi-state.js`, `sim/sim-state.js` — and changes only through
  their setters (`setFocusBlock(i)`), so searching for a setter finds every writer. Only `dispatch.js` sets the
  design. The e2e tests deep-freeze the design (`quilt-freeze.v1`), so an in-place change throws.
- **Saved format.** Designs carry a format version `v` (`FORMAT_VERSION` in `core/design.js`). Everything that
  opens a design (storage, My designs, undo steps, the tour, Cancel) goes through `readDesign` in
  `core/format.js` (via `openDesign` in the UI): it upgrades old saves one version at a time (`MIGRATIONS`), checks
  and repairs the design, and reports each repair to the user. A design from a newer version is shown but never
  saved over. To change the format: bump the version, add one migration, add a saved example to
  `tests/fixtures/designs/` (the unit tests open every file there).
- **Storage.** Everything kept between visits goes through `storage/repo.js`: `designs` (My designs),
  `fabrics` (the user's photos, named by the image's hash), `timelines` (undo, this device only) and the session
  (the quilt being edited, `mineCur`, flags). `storage/boot.js` is first in the load order: its top-level `await`
  reads the database into memory before any other module runs, so reads are synchronous and every change is
  written right after, batched per moment. Design and fabric records are shaped for a server: client-made ids,
  `rev` (save counter), `deleted` markers instead of erasing, `dirty` until uploaded. The first start moves the
  old localStorage data over (`storage/migrate.js`) and leaves the old keys alone. Small per-device preferences
  (panels open, bed, tour seen) stay in localStorage.
- **Sync** (`storage/sync.js`, shown by `mine/sync-ui.js`): when set up on My designs, saved designs and fabric
  photos are sent to the server (`server/`) and fetched from it: a few seconds after a change, when the
  connection returns, every minute, and on "Sync now". The same quilt changed on two devices keeps both
  versions ("… (this device)"). The open quilt is updated from another device only when it has no unsaved
  edits here. The development sign-in is a name (`X-Dev-User`).
- **Tools.** `node tools/move.mjs from to name…` moves declarations between modules and fixes every import;
  `node tools/chain.mjs list | unchain | insert` manages the load-order chain.

## Build

```
npm run build           # esbuild src/main.js -> dist/app.js, then quilt.html
npm run check           # format, lint, types, unit tests
npm run test:e2e        # browser tests
npm run coverage        # unit-test coverage of the pure modules (Node's own coverage)
npm run coverage:e2e    # browser-test coverage of all of src/ -> coverage/e2e/index.html (and lcov.info)
```
