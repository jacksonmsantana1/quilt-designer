# Server

The API that syncs quilts and fabric photos between a person's devices. Node 22, [Fastify](https://fastify.dev)
(web framework: routes, and every request body checked against a JSON schema), PostgreSQL 16 with pgvector,
photos in S3-compatible storage (Cloudflare R2 in production, [MinIO](https://min.io) in development).

## Run it

```
docker compose up -d                       # PostgreSQL + MinIO (docker-compose.yml, top folder)
cp server/.env.example server/.env
npm run dev -w @quilt/server               # http://localhost:8787, restarts on changes; migrates the database
API_URL=http://localhost:8787 npm run smoke -w @quilt/server   # end-to-end check of a running server
```

`npm run migrate -w @quilt/server` applies new migrations (`migrations/*.sql`, in name order, each once).

## Tests

`npm test -w @quilt/server` makes a fresh database per test file on the PostgreSQL in `TEST_DATABASE_URL`
(default `postgres://postgres@localhost:5433/postgres?host=/tmp`; with docker compose:
`TEST_DATABASE_URL=postgres://quilt:quilt@localhost:5432/postgres`), runs the migrations, and calls the API
in memory (`app.inject`). Photos go to an in-memory store; `config.test.js` checks the real S3 link signing.

## Login

Only the **stand-in login for development** for now: a request with `X-Dev-User: ana` is user "ana" (made on
first use). It is on by default in development and tests, and refused when `NODE_ENV=production`
(`AUTH_MODE=dev` there stops the server from starting; without it every `/v1` request is 401). A real login
provider will replace it with a check of the provider's signed token.

## API

Everything under `/v1` needs the login. Errors are `{ "error": code, "message": text }`.

| | |
|---|---|
| `GET /health` | `{ ok: true }` when the database answers |
| `GET /v1/changes?since=N&limit=200` | the caller's quilts and photos changed after change number N, oldest first, deletions included: `{ changes, since, more }`. Keep `since`, ask again from there while `more`. |
| `GET /v1/designs/:id` | one quilt |
| `PUT /v1/designs/:id` `{ name, design, baseRev }` | save: `baseRev` is the save counter the app's copy is based on (0 = new). 201 created / 200 changed, with `{ record, problems }` (`problems`: repairs made by the format checks). **409** `{ server }` when it was changed elsewhere: keep both. 400 not a quilt, 422 made by a newer app. |
| `DELETE /v1/designs/:id?baseRev=N` | delete: kept as a marker (`deleted: true`) so other devices learn of it |
| `POST /v1/fabrics/:id/upload` `{ name, cm, type, bytes }` | `:id` is `f` + sha-256 of the image (the app's id). `{ status: 'have' }`, or `{ status: 'upload', url, headers }`: PUT the image to `url` (10 minutes; that type and size only) |
| `POST /v1/fabrics/:id/done` | after the upload: the server checks the image is the one the id names, then lists it |
| `GET /v1/fabrics/:id` | the photo's record and a link to read it (1 hour) |
| `DELETE /v1/fabrics/:id?baseRev=N` | delete (marker kept, image removed) |

## How it stays consistent

- **Save counter (`rev`)**: every change says which `rev` it was based on; a stale one gets 409 and changes nothing.
- **Change numbers (`seq`)**: one sequence for the whole database, set on every write. Each user's writes take a
  lock on that user first (`lockOwner`), so their numbers are committed in order and a device syncing "after N"
  never misses a change.
- **Photos never pass through the API**: the browser uploads to storage with a signed link, to a fresh place each
  time; the server checks the hash, then copies the image to its lasting place, so an old link can't change it.
- **Quilts are checked with the app's own code** (`@quilt/shared/format.js`): old formats are upgraded, damaged
  ones repaired (and the repairs reported), anything else refused.
