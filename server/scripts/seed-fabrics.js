// Fills a development server with fabrics to test with: made-up patterns (scripts/fabric-patterns.js) and
// public-domain textile photos from the Metropolitan Museum of Art's open-access collection.
//   npm run seed -w @quilt/server                                  (400 patterns + 100 museum photos)
//   npm run seed -w @quilt/server -- --patterns 50 --museum 0 --user ana
// API_URL picks the server (default http://localhost:8787). Everything goes through the API the app uses
// (upload link, PUT, done) as a stand-in login user ("seed" by default); to see the fabrics in the app, set up
// sync on My designs with that name. Running it again adds only what is missing: a fabric's id is its image's
// hash. Museum photos are kept in server/.data/met (not in git), so later runs don't download them again.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { makeFabric } from './fabric-patterns.js';

const { values: opt } = parseArgs({
  options: {
    patterns: { type: 'string', default: '400' },
    museum: { type: 'string', default: '100' },
    user: { type: 'string', default: 'seed' },
  },
});
const API = process.env.API_URL || 'http://localhost:8787';
const MET = 'https://collectionapi.metmuseum.org/public/collection';
// searches that mostly find printed and woven cloth, and quilts themselves
const SEARCHES = ['printed cotton', 'chintz', 'calico', 'toile', 'quilt', 'woven silk', 'textile fragment', 'damask'];
const CACHE = new URL('../.data/met/', import.meta.url);

const call = async (method, path, body) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'x-dev-user': opt.user, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(json)}`);
  return json;
};

/** Adds one fabric photo the way the app does. @returns {Promise<'added' | 'had'>} */
async function addFabric({ name, cm, type, image }) {
  const id = 'f' + createHash('sha256').update(image).digest('hex').slice(0, 24); // the app's id for a photo
  const up = await call('POST', `/v1/fabrics/${id}/upload`, { name, cm, type, bytes: image.length });
  if (up.status === 'have') return 'had';
  const put = await fetch(up.url, { method: 'PUT', headers: up.headers, body: image });
  if (!put.ok) throw new Error(`upload of "${name}" to storage: ${put.status} ${await put.text()}`);
  await call('POST', `/v1/fabrics/${id}/done`);
  return 'added';
}

/** Runs f on every item, a few at a time. */
async function inTurn(items, at, f) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await f(items[next++]);
  };
  await Promise.all(Array.from({ length: at }, worker));
}

/** Counts results and prints progress now and then. */
function tally(label, total) {
  const n = { added: 0, had: 0 };
  return {
    n,
    add(what) {
      n[what]++;
      const done = n.added + n.had;
      if (done % 50 === 0 || done === total) console.log(`${label}: ${done}/${total} (${n.added} new)`);
    },
  };
}

// ---- the museum's photos

const wait = ms => new Promise(done => setTimeout(done, ms));
/** A request to the museum. Its firewall refuses (403/429) when asked too quickly: wait longer and try again. */
const metGet = async url => {
  for (let tries = 0; ; tries++) {
    await wait(300); // stay well under the museum's limits
    const r = await fetch(url, { headers: { 'user-agent': 'quilt-designer development seed' } });
    if (r.ok) return r;
    if (![403, 429, 503].includes(r.status) || tries === 3) throw new Error(`${url}: ${r.status}`);
    await wait(5000 * 2 ** tries);
  }
};
/** A file kept in server/.data/met, or fetched and kept there. */
async function cached(name, fetchIt) {
  const file = new URL(name, CACHE);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const data = await fetchIt();
  fs.writeFileSync(file, data);
  return data;
}

/** A JPEG's size in pixels, read from its frame header. @param {Buffer} b */
function jpegSize(b) {
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/**
 * The real width of the photo in cm, from the museum's measurements ("110 x 92 in. (280 x 235 cm)"): the longer
 * side if the photo is wider than tall, else the shorter. Rough, since some photos show a mount around the cloth;
 * 30 cm when there are no measurements. The server takes 1 to 300 cm.
 */
function photoCm(dimensions, image) {
  const m = /([\d.]+)\s*[x×]\s*([\d.]+)(?:\s*[x×]\s*[\d.]+)?\s*cm/.exec(dimensions || '');
  const size = jpegSize(image);
  if (!m || !size) return 30;
  const [a, b] = [Number(m[1]), Number(m[2])];
  const cm = size.w >= size.h ? Math.max(a, b) : Math.min(a, b);
  return Math.min(300, Math.max(1, Math.round(cm * 10) / 10));
}

/** Up to `count` public-domain textile photos: { name, cm, type, image }. */
async function museumFabrics(count) {
  fs.mkdirSync(CACHE, { recursive: true });
  // object ids from each search in turn, more than needed: some have no public-domain photo
  const lists = await Promise.all(
    SEARCHES.map(async q => {
      const url = `${MET}/v1.1/search?hasImages=true&limit=${Math.ceil((count * 2) / SEARCHES.length)}&q=${encodeURIComponent(q)}`;
      return /** @type {number[]} */ ((await (await metGet(url)).json()).objectIDs || []);
    }),
  );
  const ids = [
    ...new Set(
      lists
        .flatMap((l, s) => l.map((id, i) => ({ id, order: i * SEARCHES.length + s })))
        .sort((a, b) => a.order - b.order)
        .map(x => x.id),
    ),
  ];
  /** One object's photo as a fabric, or null when it has no public-domain JPEG. */
  const load = async id => {
    try {
      const o = JSON.parse(
        String(
          await cached(`${id}.json`, async () =>
            Buffer.from(await (await metGet(`${MET}/v1/objects/${id}`)).arrayBuffer()),
          ),
        ),
      );
      if (!o.isPublicDomain || !o.primaryImageSmall?.endsWith('.jpg')) return null;
      const image = await cached(`${id}.jpg`, async () =>
        Buffer.from(await (await metGet(o.primaryImageSmall)).arrayBuffer()),
      );
      const title = (o.title || o.objectName || 'Textile').trim();
      return { name: `${title.slice(0, 64)} · Met ${id}`, cm: photoCm(o.dimensions, image), type: 'image/jpeg', image };
    } catch (e) {
      console.warn(`museum object ${id} skipped: ${e.message}`);
      return null;
    }
  };
  // a few at a time but kept in the search order, so every run picks the same photos
  const found = [];
  for (let i = 0; i < ids.length && found.length < count; i += 2)
    for (const f of await Promise.all(ids.slice(i, i + 2).map(load))) if (f && found.length < count) found.push(f);
  return found;
}

// ---- run

const patterns = Number(opt.patterns),
  museum = Number(opt.museum);
console.log(`Seeding ${API} as user "${opt.user}": ${patterns} patterns, ${museum} museum photos`);
await call('GET', '/v1/changes?since=0&limit=1'); // stops here with a clear message if the server isn't running

const made = tally('patterns', patterns);
await inTurn(
  Array.from({ length: patterns }, (_, n) => n),
  4,
  async n => {
    const f = makeFabric(n);
    made.add(await addFabric({ name: f.name, cm: f.cm, type: 'image/png', image: f.png }));
  },
);

if (museum > 0) {
  console.log('Finding museum photos (first run downloads them, about 250 kB each)...');
  const photos = await museumFabrics(museum);
  const met = tally('museum photos', photos.length);
  await inTurn(photos, 4, async p => met.add(await addFabric(p)));
  if (photos.length < museum) console.log(`Only ${photos.length} museum photos found: the searches ran out.`);
}
console.log(`Done. In the app: My designs → Set up sync → ${API}, name "${opt.user}".`);
