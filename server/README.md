# Server

The API that syncs quilts and fabric photos between a person's devices. Node 22, [Fastify](https://fastify.dev)
(web framework: routes, and every request body checked against a JSON schema), PostgreSQL 16 with pgvector,
photos in S3-compatible storage (Cloudflare R2 in production, [SeaweedFS](https://github.com/seaweedfs/seaweedfs) in development).

## Run it

```
docker compose up -d                       # PostgreSQL + SeaweedFS (docker-compose.yml, top folder)
cp server/.env.example server/.env
npm run dev -w @quilt/server               # http://localhost:8787, restarts on changes; migrates the database
API_URL=http://localhost:8787 npm run smoke -w @quilt/server   # end-to-end check of a running server
npm run seed -w @quilt/server             # 500 test fabrics (patterns + Met museum photos) for user "seed"
```

Without SeaweedFS, `STORAGE=local` keeps photos in `server/.data/photos` and the API serves them itself (signed
links like S3's). It is for development only: production refuses it.

To try sync with the app: serve the app from `http://localhost:8000` (for example `python3 -m http.server 8000`
in `app/`, `py -m` on Windows, then open `quilt.html`), open **My designs → Set up sync**, enter
`http://localhost:8787` and a name. A second browser profile with the same name is a second device. The page must be served from localhost:
the published page on claude.ai can't reach a server on your computer, and needs the server on the internet.

`npm run migrate -w @quilt/server` applies new migrations (`migrations/*.sql`, in name order, each once).

## Going live

Everything here needs the owner's accounts. Passwords and keys go only into the host's secret storage and GitHub's:
never in the code or a chat. On the first try, expect small corrections: none of this has run on a real host yet.

**1. Accounts.** Fly.io, Neon, Cloudflare and Sentry, with two-factor sign-in on each.

**2. Database.** A Neon project in **AWS São Paulo** (the region can't be changed later) with PostgreSQL 16. Its
connection address must end in `?sslmode=require`: the server refuses to start otherwise. Check that it offers the
`vector` extension, which the first migration turns on.

**3. Storage.** Two private R2 buckets, each with its own key: one for photos, one for backups.
- Photos: allow `PUT` and `GET` from the page's address (the bucket's CORS settings), and add a rule that removes
  `uploads/` after a day, for uploads never finished.
- Backups: nothing public. Keep the key to this bucket out of the server's settings.

**4. The API on Fly.io.** `fly.toml` holds what isn't secret. Change its `app` name if it's taken, because that name
gives the API's address. From the top folder:

```
fly launch --no-deploy --copy-config
fly secrets set DATABASE_URL=... S3_ENDPOINT=... S3_BUCKET=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=...
fly secrets set AUTH0_DOMAIN=... AUTH0_AUDIENCE=https://api.quilt-designer CORS_ORIGINS=https://... SENTRY_DSN=...
fly deploy
```

Then `https://<app>.fly.dev/health` answers `{"ok":true}`. The tables are made when the server starts. In Sentry, use
separate projects for the API and the page.

**5. The page on Cloudflare Pages.** From the top folder, with the API's address and the page's Sentry address:

```
API_URL=https://<app>.fly.dev SENTRY_DSN=https://... npm run publish:page -w @quilt/app
npx wrangler pages deploy app/publish --project-name block-and-bind
```

`_headers` in that folder holds the page's protection. Check it arrived: the page's response has a
`Content-Security-Policy` header.

**6. Auth0.** Add the page's address: Allowed Callback URLs and Allowed Web Origins (the origin), Allowed Logout URLs
(the page itself). Also turn on Refresh Token Rotation, and give Google sign-in your own keys, not Auth0's dev keys.

**7. Backups on.** In the GitHub repository, add the secrets `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE`,
`BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID` and `BACKUP_S3_SECRET_ACCESS_KEY`, and the
variable `BACKUPS_ON` = `true`. Run "Nightly backup" once by hand under Actions, then restore it (below) before relying
on it. **Keep the passphrase somewhere safe outside GitHub: without it, the backups can't be read.**

**8. Watching.** An uptime monitor on `/health`, every few minutes, not more often: it wakes the database, which is paid
by the hour. Trigger one test error from the API and one from the page, and check Sentry shows them with no personal
data.

**9. Before opening to everyone:** the terms of use and privacy policy, and a way to delete an account.

### Updating

On Windows, `deploy.ps1` in the top folder does all of it, once GitHub's checks have passed for main: it checks the
folder is on main with nothing changed, pulls, checks the CI of that version, builds the page, deploys the API (Wi-Fi's
IPv6 off meanwhile, as an administrator), waits for `/health`, then publishes the page. `-DryRun` stops before anything
goes online. Run it through `deploy.bat`: Windows blocks `.ps1` files by default, and the .bat runs it without
changing that setting.

```
.\deploy.bat -ApiUrl https://block-and-bind-api.fly.dev -SentryDsn https://...
```

By hand:

```
fly deploy                                    # the API, when server/ or shared/ changed
API_URL=... SENTRY_DSN=... npm run publish:page -w @quilt/app   # the page, then wrangler as above
```

A change to the database goes first in a new file in `migrations/`, and must keep working with the version running just
before it, since that is what going back returns to.

### When something goes wrong

- **A bad version of the API:** `fly releases --image` lists them; `fly deploy --image <the last good one>` goes back.
- **A bad version of the page:** in Cloudflare Pages, "Rollback" on the last good deployment.
- **The API is down:** `fly status`, `fly logs`. `/alive` answering while `/health` fails means the database.
- **Data damaged:** first stop writes with `fly scale count 0`. Neon can restore to a moment in its restore window, into
  a new branch. Older than that, the nightly backups below. Then point `DATABASE_URL` at the good copy, and scale back to 1.
- **A key leaked:** make a new one where it was issued, `fly secrets set`, then delete the old one.
- **Something on Community that must go:** `npm run moderate -w @quilt/server hide <id>`, with `DATABASE_URL` set.

### Backups

`npm run backup -w @quilt/server` is one backup, as GitHub runs it each night (`.github/workflows/backup.yml`): the
database's own `pg_dump`, encrypted with gpg, in the backups bucket. It keeps 30 days (`BACKUP_DAYS`) and never fewer
than the last 7. Photos are not in it: they stay in R2. Needs Docker, gpg and node.

To bring one back, into a **new, empty** database (it refuses any other):

```
RESTORE_DATABASE_URL=... BACKUP_PASSPHRASE=... BACKUP_S3_...=... npm run restore -w @quilt/server latest
```

`node server/scripts/backup-store.js list` shows them; give a name instead of `latest` for an older one. GitHub pauses
scheduled runs of a public repository after 60 days without activity, and says so by email: turn it back on under Actions.

## Tests

`npm test -w @quilt/server` makes a fresh database per test file on the PostgreSQL in `TEST_DATABASE_URL`
(default `postgres://postgres@localhost:5433/postgres?host=/tmp`; with docker compose:
`TEST_DATABASE_URL=postgres://quilt:quilt@localhost:5432/postgres`), runs the migrations, and calls the API
in memory (`app.inject`). Photos go to an in-memory store; `config.test.js` checks the real S3 link signing.

## Login

**Auth0.** The app signs people in with Auth0 and sends `Authorization: Bearer <token>`. The server checks the
token against Auth0's public keys (`AUTH0_DOMAIN`): issued by that tenant, for this API (`AUTH0_AUDIENCE`),
RS256-signed, not expired. The token's `sub` is the user (made on first use). With `AUTH0_DOMAIN` set, `auth0` is
the production default; without it, every `/v1` request is 401.

The **stand-in login for development** stays: with `AUTH_MODE=dev` (the default in development and tests), a
request with `X-Dev-User: ana` is user "ana", and Auth0 tokens work too. It is refused when
`NODE_ENV=production` (`AUTH_MODE=dev` there stops the server from starting). The tests never reach Auth0: they
sign their own tokens with a test key (`buildApp({ keys })`, see `test/auth0.test.js`).

## API

Everything under `/v1` needs the login. Errors are `{ "error": code, "message": text }`.

| | |
|---|---|
| `GET /health` | `{ ok: true }` when the database answers |
| `GET /v1/changes?since=N&limit=200` | the caller's quilts and photos changed after change number N, oldest first, deletions included: `{ changes, since, more }`. Keep `since`, ask again from there while `more`. |
| `GET /v1/designs/:id` | one quilt (ids are per person: a UUID, or the shorter ids of older saves and samples) |
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
