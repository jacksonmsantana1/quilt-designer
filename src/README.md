# Front end source

Plain JavaScript ES modules, bundled by esbuild into `dist/app.js`; `build.py` puts the bundle into `template.html`
to make `quilt.html`. The three.js libraries stay external: the page's import map loads them from the CDN.
The cloth physics (`../physics.js`) is a separate classic script; it runs in a Web Worker.

```
core/       dom helpers, block patterns, quilt geometry (mm), shared state
render/     drawing the quilt top, quilting lines, cutting-guide highlight
designer/   the Quilt designer: design state, canvas, side panels, symmetry, hover, settings
cutting/    cutting plan (pure), drawings and the Cutting guide page
pdf/        the A4 cutting-guide PDF and real-size templates
sim/        3D simulation: renderer, stage, bed/table, camera, quilt mesh, physics link, photo render, analysis
mine/       My designs and the sample designs
timeline/   undo / redo and the film strip
tour/       guided tour
camera/     new fabric from the webcam
platform/   saving files
ui/         foldable cards
app/        pages, layout, animation loop, start-up
main.js     entry point
```

## Rules

- **Pure modules** (`core/patterns`, `core/geometry`, `core/symmetry`, `core/types`, `cutting/plan`, `core/dom`,
  `core/shared`) are not in the chain: they have no side effects when loaded and import nothing that is, so they
  can be imported anywhere, including the unit tests in Node. Keep them that way.
- **Load order.** Each other module's first import is the module before it (`import './previous.js'`), and `main.js`
  imports the last one. ES modules run depth-first and skip modules that are already loading, so the modules run
  in exactly the order the app was written in. Keep that first import when you add a module: put the new module
  in the chain where its top-level code has to run.
- **Shared state.** ES module imports are read-only. Top-level values that several modules assign (`design`,
  `selBlocks`, `focusBlock`, `mineCur`, …) live on the `shared` object in `core/shared.js`; the comment there says
  which module sets each one. Everything else is exported by the module that declares it.
- **Tools.** `node tools/move.mjs from to name…` moves declarations between modules and fixes every import;
  `node tools/chain.mjs list | unchain | insert` manages the load-order chain.

## Build

```
npm run build           # esbuild src/main.js -> dist/app.js, then quilt.html
npm run check           # format, lint, types, unit tests
npm run test:e2e        # browser tests
```
