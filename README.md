# Quilt designer

Design a quilt block by block, get its cutting guide and an A4 PDF, and see it draped on a bed or table.
Plain JavaScript (ES modules), three.js for the 3D view, cloth physics in a Web Worker.

## Commands

```
npm install            # dev tools: esbuild, prettier, eslint, typescript, playwright test runner, three.js for tests
npm run build          # src/ -> dist/app.js -> quilt.html  (python3 build.py)
python3 standalone.py  # one HTML file with every asset inlined
npm run check          # format check, lint, type check, unit tests
npm run test:e2e       # browser tests (build first)
npm run format         # format the code
```

## Layout

- `src/` – the front end, one module per feature; see `src/README.md`.
- `src/core/types.js` – the `Design` data type (JSDoc); `npm run typecheck` checks the pure modules against it.
- `physics.js` – cloth simulation (runs in a Web Worker).
- `template.html` – page markup and styles; `build.py` puts the bundle into it.
- `tests/unit/` – unit tests of the pure core (geometry, patterns, symmetry, cutting plan), `node:test`.
- `tests/e2e/` – browser tests with Playwright, sharing `fixtures.mjs`.
- `tools/` – `move.mjs` moves declarations between modules and fixes imports; `chain.mjs` manages the load order.
- `tests/legacy/` – old one-off scripts, kept for reference.

## Lint warnings

`npm run lint` reports `no-param-reassign` warnings: the places that change the design in place.
They are the list of work for the next step (pure edits through one `dispatch`).
