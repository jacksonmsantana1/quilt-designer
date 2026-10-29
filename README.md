# Quilt designer

Design a quilt block by block, get its cutting guide and an A4 PDF, and see it draped on a bed or table.
The app works on its own in the browser (IndexedDB); the server, when used, syncs quilts and fabric photos
between a person's devices.

```
app/      the front end: plain JavaScript ES modules, three.js, cloth physics in a Web Worker (see app/src/README.md)
shared/   code both sides use: block patterns, quilt geometry, the saved design format and its checks
server/   the API: Node, Fastify, PostgreSQL, photo storage on S3 / Cloudflare R2 (see server/README.md)
```

npm workspaces: one `npm install` at the top installs everything; `@quilt/shared` is linked into both.

## Commands (from the top folder)

```
npm install            # everything
npm run build          # the app: app/src -> app/dist/app.js -> app/quilt.html
npm run check          # format check, lint, type check, and the unit tests of shared, app and server
npm run test:e2e       # the app's browser tests (build first)
npm run format         # format the code
```

The app has more commands (stand-alone page, coverage) in `app/package.json`; the server's are in
`server/README.md`.
