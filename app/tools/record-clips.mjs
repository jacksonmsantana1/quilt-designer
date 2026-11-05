// Records the short clips of the welcome page's feature cards from the real app, with a visible pointer:
//   node app/tools/record-clips.mjs [block|cut|fabric|bed ...]     (build first; needs ffmpeg, and pdftoppm for "cut")
//   node app/tools/record-clips.mjs tutorial                       the first-quilt tutorial's clips, in both languages
//   CLIP_ONLY=sash,fabric node app/tools/record-clips.mjs tutorial only those are saved (the others are still acted out,
//                                                                  since each follows on from the one before)
// Every frame is a screenshot taken when the script is ready, not in real time, so a slow computer gives the same clip.
// All four follow one quilt: it's made in "block", cut in "cut", gets a new fabric in "fabric", goes on the bed in "bed".
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { newBlock, newDesign } from '@quilt/shared/design.js';
import { blockPlace } from '@quilt/shared/geometry.js';
import { partsOf } from '@quilt/shared/patterns.js';
import { withSymmetry } from '../src/core/symmetry.js';

const APP = path.resolve(import.meta.dirname, '..');
const NM = path.join(APP, '..', 'node_modules');
const WORK = process.env.CLIP_WORK || path.join(os.tmpdir(), 'quilt-clips'); // frames (not app/test-results: the browser tests empty it)
const OUT = process.env.CLIP_OUT || path.join(APP, 'assets', 'clips');
const ORIGIN = 'http://localhost:9'; // localhost: a secure context, so a photo gets its real fingerprint
const LANG = process.env.CLIP_LANG || 'pt-BR'; // the language of the app in the clips
/** The clips' own words, and the names of the made-up photos. */
const T = {
  en: {
    realSize: 'Real size',
    photo: 'My paisley',
    stripe: 'Blue stripe',
    linen: 'Green linen',
    scroll: 'More along the row',
  },
  'pt-BR': {
    realSize: 'Tamanho real',
    photo: 'Meu paisley',
    stripe: 'Listra azul',
    linen: 'Linho verde',
    scroll: 'Há mais na fileira',
  },
}[LANG];
const FPS = 30;
const FRAME_W = 1280; // frames are made larger than the video, for sharp edges
const VIDEO_W = 960; // the cards show them up to about 660 wide: sharp on high-resolution screens too
const CARD_BG = '#fef9f1'; // the card's background: each clip fades from and to it, so the loop has no jump
const LIBS = [
  [/three@0\.183\.2\/(.*)$/, 'three'],
  [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'],
  [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer'],
];

// ---- the quilt of the clips: 5 × 5, mirrored eight ways, so one click changes up to eight blocks
const [CREAM, INDIGO, MUSTARD, RED] = ['b0', 'b1', 'b3', 'b4'];
/** the block at each of the six places an 8-way mirror leaves free (the rest are mirror images) */
const HERO = {
  corner: () => newBlock('sawstar', [CREAM, INDIGO, MUSTARD]),
  edge: () => newBlock('geese', [CREAM, INDIGO, MUSTARD]),
  middle: () => newBlock('nine', [CREAM, RED, MUSTARD]),
  inner: () => newBlock('ohio', [CREAM, RED, MUSTARD]),
  side: () => newBlock('hst', [CREAM, INDIGO, MUSTARD]),
  centre: () => newBlock('twisted', [CREAM, RED, MUSTARD]), // its slanted pieces get real-size templates in the PDF
};
const PLACE = [
  ['corner', 'edge', 'middle', 'edge', 'corner'],
  ['edge', 'inner', 'side', 'inner', 'edge'],
  ['middle', 'side', 'centre', 'side', 'middle'],
  ['edge', 'inner', 'side', 'inner', 'edge'],
  ['corner', 'edge', 'middle', 'edge', 'corner'],
];
/** @param {Partial<Record<keyof HERO, () => object>>} [over] blocks to swap */
function heroDesign(over = {}, fields = {}) {
  const make = { ...HERO, ...over };
  const d = {
    v: 8,
    cols: 5,
    rows: 5,
    blockMm: 458,
    backFabric: CREAM,
    sym: 'kal',
    blocks: PLACE.flat().map(k => make[k]()),
    borders: [{ type: 'plain', mm: 90, fabrics: [INDIGO, INDIGO, INDIGO] }],
    ...fields,
  };
  if (!d.sym) return d;
  return withSymmetry(d, [0, 1, 2, 6, 7, 12]); // the top-left eighth, mirrored by the app's own code
}
/** The same blocks made to fit the 6-seat table (900 × 1800 mm): 1380 × 2220 mm, so it hangs about 22 cm all round. */
function tableDesign() {
  const d = {
    v: 8,
    cols: 3,
    rows: 5,
    blockMm: 420,
    backFabric: CREAM,
    sym: 'both',
    blocks: [
      ['corner', 'middle', 'corner'],
      ['edge', 'inner', 'edge'],
      ['middle', 'centre', 'middle'],
      ['edge', 'inner', 'edge'],
      ['corner', 'middle', 'corner'],
    ]
      .flat()
      .map(k => HERO[k]()),
    borders: [{ type: 'plain', mm: 60, fabrics: [INDIGO, INDIGO, INDIGO] }],
  };
  return withSymmetry(d, [0, 1, 3, 4, 6, 7]); // the top-left quarter, mirrored
}

// ---- the app in a browser, with the libraries from node_modules
async function openApp(design, { viewport = { width: 1300, height: 960 }, dpr = 2, recent = [], photos = [] } = {}) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.addInitScript(
    r => {
      localStorage.setItem('quilt-freeze.v1', '1');
      localStorage.setItem('quilt-welcome.v1', 'skip');
      localStorage.setItem('quilt-tour.v1', 'done');
      localStorage.setItem('quilt-recent-blocks.v1', JSON.stringify(r.recent));
      localStorage.setItem('quilt-lang.v1', r.lang);
    },
    { recent, lang: LANG },
  );
  const html = fs.readFileSync(path.join(APP, 'quilt.html'), 'utf8');
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of LIBS) {
      const m = u.match(re);
      if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' });
    }
    if (u.startsWith(ORIGIN + '/assets/'))
      return r.fulfill({ path: path.join(APP, u.slice(ORIGIN.length + 1).split('#')[0]) });
    if (u.startsWith(ORIGIN + '/')) return r.fulfill({ body: html, contentType: 'text/html' });
    if (u.startsWith('https://fonts.')) return r.continue();
    return r.abort();
  });
  const ready = async () => {
    await page.locator('#page-design').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
  };
  await page.goto(ORIGIN + '/#design');
  await ready();
  await page.evaluate(
    async ({ d, photos }) => {
      const s = globalThis.__quiltStorage;
      s.setSession('current', d);
      for (const p of photos) {
        const blob = await (await fetch(p.url)).blob();
        await s.fabrics.add(blob, { name: p.name, cm: p.cm });
      }
      await s.flush();
    },
    {
      d: design,
      photos: photos.map(p => ({ ...p, url: 'data:image/jpeg;base64,' + fs.readFileSync(p.file).toString('base64') })),
    },
  );
  await page.reload();
  await ready();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  return { browser, page };
}

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a, b, t) => a + (b - a) * t;

// ---- the recorder: a camera (a rectangle of the page), a pointer, and frames
class Clip {
  constructor(page, name, cam) {
    this.page = page;
    this.name = name;
    this.dir = path.join(WORK, name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.n = 0;
    this.cam = cam;
    this.pt = { x: cam.x + cam.w * 0.5, y: cam.y + cam.h + 60 };
  }
  async start({ pointer = true } = {}) {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.dpr = await this.page.evaluate(() => devicePixelRatio);
    if (!pointer) return;
    await this.page.evaluate(() => {
      document.getElementById('clip-cursor')?.remove();
      const c = document.createElement('div');
      c.id = 'clip-cursor';
      c.popover = 'manual'; // in the top layer, so it stays above the dialogs
      c.style.cssText =
        'position:fixed;left:0;top:0;margin:0;padding:0;border:0;background:none;overflow:visible;width:46px;height:46px;pointer-events:none;inset:auto auto auto auto;';
      c.innerHTML =
        '<span id="clip-ring" style="position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;background:rgba(181,83,47,.4);transform:scale(0);opacity:0"></span>' +
        '<svg width="46" height="46" viewBox="0 0 24 24" style="position:absolute;left:-7px;top:-3px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))"><path d="M4 2 L4 19 L8.6 15 L11.6 22 L14.6 20.7 L11.6 14 L18 14 Z" fill="#fff" stroke="#2a1a12" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      document.documentElement.append(c);
      c.showPopover();
      window.__clipTop = () => {
        c.hidePopover();
        c.showPopover();
      };
    });
    await this.pointer();
  }
  async pointer() {
    await this.page.evaluate(({ x, y }) => {
      document.getElementById('clip-cursor').style.transform = `translate(${x}px, ${y}px)`;
    }, this.pt);
  }
  async capture() {
    const { x, y, w, h } = this.cam;
    const { data } = await this.cdp.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 94,
      clip: { x, y, width: w, height: h, scale: FRAME_W / w / this.dpr },
    });
    return Buffer.from(data, 'base64');
  }
  write(buf) {
    fs.writeFileSync(path.join(this.dir, `f${String(this.n++).padStart(5, '0')}.jpg`), buf);
  }
  async shot() {
    const buf = await this.capture();
    this.write(buf);
    return buf;
  }
  /**
   * The physics runs in its worker on its own clock, so it would not wait for a slow screenshot: it runs a small step
   * of its time, pauses (the app's Pause button) for the picture, and so on, however busy the computer is.
   * @param {number} seconds of physics @param {number} [stretch] above 1: slow motion, to see the cloth settle
   */
  async simFrames(seconds, stretch = 1) {
    const N = Math.round(seconds * FPS * stretch);
    for (let f = 0; f < N; f++) {
      await this.page.evaluate(
        async ({ until, first }) => {
          const frame = () => new Promise(requestAnimationFrame);
          const now = () => parseFloat(document.getElementById('clock').textContent.slice(4).replace(',', '.'));
          const pause = document.getElementById('pause');
          if (!first) pause.click();
          while (now() < until) await frame();
          pause.click();
          await frame();
          await frame();
        },
        { until: f / (FPS * stretch), first: f === 0 },
      );
      await this.shot();
    }
    await this.page.locator('#pause').evaluate(b => b.click()); // running again
  }
  /** the same picture for a while @param {number} ms */
  async hold(ms) {
    const buf = await this.shot();
    for (let i = 1; i < Math.round((ms / 1000) * FPS); i++) this.write(buf);
  }
  /** a frame for each step of fn(t), t from 0 to 1, eased @param {number} ms @param {(t: number) => any} fn */
  async tween(ms, fn) {
    const N = Math.max(1, Math.round((ms / 1000) * FPS));
    for (let i = 1; i <= N; i++) {
      await fn(ease(i / N));
      await this.shot();
    }
  }
  /** the pointer glides to a place, the real mouse with it (the app shows its hover states) */
  async move(x, y, ms = 500, cam) {
    const a = { ...this.pt },
      c0 = { ...this.cam };
    await this.tween(ms, async t => {
      this.pt = { x: mix(a.x, x, t), y: mix(a.y, y, t) };
      if (cam)
        this.cam = { x: mix(c0.x, cam.x, t), y: mix(c0.y, cam.y, t), w: mix(c0.w, cam.w, t), h: mix(c0.h, cam.h, t) };
      await this.pointer();
      // the real mouse only near the end: passing over the quilt would light up every block on the way
      if (t > 0.8) await this.page.mouse.move(this.pt.x, this.pt.y);
    });
  }
  async moveTo(locator, ms, cam) {
    const b = await locator.boundingBox();
    await this.move(b.x + b.width / 2, b.y + b.height / 2, ms, cam);
  }
  /** a click with a ring that spreads from the pointer, so it can be seen @param {() => Promise<any>} [act] */
  async click(act) {
    const ring = (s, o) =>
      this.page.evaluate(
        ([s, o]) => {
          const r = document.getElementById('clip-ring');
          r.style.transform = `scale(${s})`;
          r.style.opacity = o;
        },
        [s, o],
      );
    for (let i = 1; i <= 3; i++) {
      await ring(i * 0.3, 0.9);
      await this.shot();
    }
    if (act) await act();
    else await this.page.mouse.click(this.pt.x, this.pt.y);
    await this.page.evaluate(() => window.__clipTop());
    await this.pointer();
    for (let i = 4; i <= 9; i++) {
      await ring(i * 0.3, 0.9 * (1 - (i - 3) / 6));
      await this.shot();
    }
  }
  /** a click in a third of the time, for the story's quick moves @param {() => Promise<any>} [act] */
  async quickClick(act) {
    const ring = (s, o) =>
      this.page.evaluate(
        ([s, o]) => {
          const r = document.getElementById('clip-ring');
          r.style.transform = `scale(${s})`;
          r.style.opacity = o;
        },
        [s, o],
      );
    await ring(0.8, 0.9);
    await this.shot();
    if (act) await act();
    else await this.page.mouse.click(this.pt.x, this.pt.y);
    await ring(1.3, 0.5);
    await this.shot();
    await ring(0, 0);
    await this.shot();
  }
  async camera(to, ms = 600) {
    const c0 = { ...this.cam };
    await this.tween(ms, t => {
      this.cam = { x: mix(c0.x, to.x, t), y: mix(c0.y, to.y, t), w: mix(c0.w, to.w, t), h: mix(c0.h, to.h, t) };
    });
  }
  /** a row that scrolls sideways brings a tile into view, as a person would @param {import('playwright').Locator} tile */
  async reveal(tile) {
    const [from, to] = await tile.evaluate(el => {
      let box = el.parentElement;
      while (box.scrollWidth <= box.clientWidth + 1) box = box.parentElement;
      window.__clipRow = box;
      const a = box.getBoundingClientRect(),
        b = el.getBoundingClientRect(),
        l = box.scrollLeft;
      return [l, b.left < a.left + 8 ? l + b.left - a.left - 8 : b.right > a.right - 8 ? l + b.right - a.right + 8 : l];
    });
    if (to !== from)
      await this.tween(280, t =>
        this.page.evaluate(
          v => {
            window.__clipRow.scrollLeft = v;
          },
          mix(from, to, t),
        ),
      );
  }
  /** frames -> video and GIF */
  encode({ posterAt } = {}) {
    fs.mkdirSync(OUT, { recursive: true });
    const dur = this.n / FPS;
    const scale = (w, h = this.square ? w : (w * 5) / 8) => `scale=${w}:${h}:flags=lanczos:out_range=tv,setsar=1`; // 16:10; video colour range
    const ffmpeg = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
    const out = ext => path.join(OUT, `${this.name}.${ext}`);
    // one clean copy of a fixed size first: frames in a camera move differ by a pixel
    const master = path.join(WORK, `${this.name}-master.mp4`);
    const fade = this.story
      ? 'null'
      : `fade=t=in:st=0:d=0.2:c=${CARD_BG},fade=t=out:st=${(dur - 0.35).toFixed(2)}:d=0.35:c=${CARD_BG}`;
    ffmpeg(
      '-framerate',
      String(FPS),
      '-i',
      path.join(this.dir, 'f%05d.jpg'),
      '-vf',
      `${scale(1280)},${fade}`,
      '-c:v',
      'libx264',
      '-crf',
      '12',
      '-preset',
      'fast',
      '-pix_fmt',
      'yuv420p',
      master,
    );
    ffmpeg(
      '-i',
      master,
      '-vf',
      scale(this.square ? 640 : VIDEO_W),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '25',
      '-preset',
      'veryslow',
      '-movflags',
      '+faststart',
      '-an',
      out('mp4'),
    );
    ffmpeg(
      '-i',
      master,
      '-vf',
      scale(this.square ? 640 : VIDEO_W),
      '-c:v',
      'libvpx-vp9',
      '-crf',
      '46',
      '-b:v',
      '0',
      '-row-mt',
      '1',
      '-an',
      out('webm'),
    );
    ffmpeg(
      '-i',
      master,
      '-vf',
      `fps=12,${scale(this.square ? 320 : 400)},split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
      '-loop',
      '0',
      out('gif'),
    );
    const at = posterAt ?? this.n - Math.round(0.5 * FPS);
    fs.copyFileSync(
      path.join(this.dir, `f${String(at).padStart(5, '0')}.jpg`),
      path.join(WORK, `${this.name}-poster-big.jpg`),
    );
    ffmpeg(
      '-i',
      path.join(WORK, `${this.name}-poster-big.jpg`),
      '-vf',
      scale(this.square ? 640 : VIDEO_W),
      '-q:v',
      '4',
      out('jpg'),
    );
    for (const e of ['mp4', 'webm', 'gif', 'jpg'])
      console.log(out(e), Math.round(fs.statSync(out(e)).size / 1024) + ' KB');
    console.log(this.name, this.n, 'frames,', dur.toFixed(1), 's');
  }
}

// ---- the clips
/** The middle of a block on the designer's canvas, in page coordinates. */
async function blockSpot(page, d, i) {
  const box = await page.locator('#dz-quilt').boundingBox();
  const P = blockPlace(d, i, box.width, box.height);
  return { x: box.x + P.x + P.w / 2, y: box.y + P.y + P.h / 2 };
}
/** The tutorial's quilt, as tour.js starts it. */
const tutorialDesign = () => ({ ...newDesign(), blockMm: 254 });
/** The logo, in the corner of what the camera sees (the app's own, from its top bar). */
async function logoOn(page, cam) {
  await page.evaluate(
    ({ x, y }) => {
      document.getElementById('clip-logo')?.remove();
      const c = document.createElement('div');
      c.id = 'clip-logo';
      c.popover = 'manual';
      c.style.cssText = `position:fixed;left:${x}px;top:${y}px;margin:0;padding:4px;border:0;background:#fef9f1;border-radius:6px;overflow:visible;width:34px;height:34px;box-sizing:content-box`;
      c.innerHTML = document.querySelector('.app-logo svg').outerHTML;
      c.firstElementChild.style.cssText = 'display:block;width:34px;height:34px';
      document.documentElement.append(c);
      c.showPopover();
    },
    { x: cam.x + cam.w - 54, y: cam.y + cam.h - 54 },
  );
}
/** Where to press on the big block of the panel to get a part of the first kind of this colour role. */
async function partSpot(page, pattern, role) {
  const poly = partsOf(pattern).find(p => p.role === role).poly;
  const big = await page.locator('#dz-block').boundingBox();
  return {
    x: big.x + (big.width * poly.reduce((a, p) => a + p[0], 0)) / poly.length,
    y: big.y + (big.height * poly.reduce((a, p) => a + p[1], 0)) / poly.length,
  };
}
/** The panel's lists closer together, so the clip can be framed tighter. */
const COMPACT = `#dz-libbox, #dz-parts-info { display: none !important; }`;
const WHOLE_WITH_PANEL = { x: 128, y: 112, w: 1158, h: 724 };
const uri = (file, type = 'image/jpeg') => `data:${type};base64,` + fs.readFileSync(file).toString('base64');

/** A made-up photo: a bundled fabric, recoloured. @param {string} name @param {string} src @param {string} vf @returns {string} its file */
function recolour(name, src, vf) {
  const out = path.join(WORK, name);
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    path.join(APP, 'assets', 'fabric', src),
    '-vf',
    `${vf},scale=800:800`,
    '-q:v',
    '3',
    out,
  ]);
  return out;
}
/** The 3D view in the bedroom, for a piece of furniture, and dropping the quilt on it for a clip. */
function simTools(page) {
  const choose = (id, v) =>
    page.evaluate(
      ([id, v]) => {
        const s = document.getElementById(id);
        s.value = v;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      },
      [id, v],
    );
  const openSim = async (furniture, height) => {
    await page.locator('#dz-sim').click({ timeout: 60_000 });
    await page.locator('#page-sim').waitFor();
    await page.waitForFunction(() => getComputedStyle(document.getElementById('loading')).display === 'none', null, {
      timeout: 60_000,
    });
    await page.addStyleTag({ content: '.hud, #hint, #stage-ctl, #legend3d { visibility: hidden !important; }' });
    await choose('stagesel', 'bedroom');
    await choose('bedsel', furniture);
    // slower than the app's slowest speed, so the screenshots keep up with the physics
    await page.evaluate(() => document.getElementById('speed').add(new Option('slow', '0.12')));
    await choose('speed', '0.12');
    // from higher up than usual: the fall itself is the show
    await page.evaluate(h => {
      const el = document.getElementById('dropH');
      el.value = String(h);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, height);
    await page.locator('#restart').click(); // once unseen: the first drop in a new scene runs slowly
    await page.waitForTimeout(3000);
  };
  const clockReset = () =>
    page.waitForFunction(
      () => parseFloat(document.getElementById('clock').textContent.slice(4).replace(',', '.')) < 0.1,
    );
  const drop = async (clip, seconds, stretch) => {
    await page.locator('#restart').click();
    await clockReset();
    await clip.simFrames(seconds, stretch);
  };
  return { choose, openSim, drop };
}

const CLIPS = {
  // The four steps of the welcome page: one quilt in one sitting, from the three empty blocks a new design starts with
  // to the bed. Square, close on the quilt, with the panel's lists laid under it: the steps' pictures are small.
  async story() {
    const mine = recolour('my-paisley.jpg', 'paisley.jpg', 'hue=h=150:s=1.25,eq=contrast=1.15:brightness=-0.02');
    const start = newDesign();
    const { browser, page } = await openApp(heroDesign({}, { cols: 5, rows: 5, sym: undefined, borders: undefined }), {
      viewport: { width: 1300, height: 1000 },
      recent: ['twisted', 'hst', 'ohio', 'nine', 'geese', 'sawstar'],
      photos: [{ file: mine, name: T.photo, cm: 35 }],
    });
    const photo = await page.evaluate(
      n => globalThis.__quiltStorage.fabrics.list().find(f => f.name === n).id,
      T.photo,
    );
    // the panel's lists under the quilt; the frame is fixed around the finished 5 × 5 quilt, measured like this
    const lay = (x = 0, y = 0, w = 300) => `
      .dz-side { position: fixed !important; left: ${x}px !important; top: ${y}px !important; width: ${w}px !important; height: 136px; max-height: none !important; overflow: hidden !important; padding: 0 !important; z-index: 5; }
      #dz-sideparts { display: flex !important; gap: 12px; align-items: flex-start; padding: 0 !important; margin: 0 !important; border: 0 !important; background: none !important; box-shadow: none !important; width: 100%; }
      #dz-libbox, #dz-partsbox > :not(.dz-blockwrap), #dz-fabbox > :not(.fabs-row), #dz-patbox > :not(.fabs-row), .fab-more-stack, .dz-side .card-cancel { display: none !important; }
      #dz-partsbox { flex: 0 0 auto; margin: 0 !important; } #dz-fabbox, #dz-patbox { flex: 1 1 0; min-width: 0; margin: 0 !important; }
      .dz-blockwrap, .dz-blockwrap canvas { width: 128px !important; height: 128px !important; margin: 0 !important; }
      .fab-more-btn, .fab-more-float, #dz-size2, .hover-rot { display: none !important; }
      body:not(.clip-c) .rail, body:not(.clip-c) .sym-wrap, body:not(.clip-c) .sym-row { visibility: hidden !important; }
      body.clip-a #dz-partsbox, body.clip-a #dz-fabbox, body.clip-b #dz-patbox, body.clip-c .dz-side { display: none !important; }`;
    const openPanel = async d => {
      const at = await blockSpot(page, d, 0);
      await page.mouse.click(at.x, at.y);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(500);
    };
    await page.addStyleTag({ content: lay() });
    await openPanel(heroDesign({}, { sym: undefined, borders: undefined }));
    const Q = await page.locator('#dz-quilt').boundingBox();
    const bar = await page.locator('#dz-size').boundingBox();
    await page.evaluate(async d => {
      const s = globalThis.__quiltStorage;
      s.setSession('current', d);
      await s.flush();
    }, start);
    await page.reload();
    await page.locator('#page-design').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: lay(Q.x, Q.y + Q.height + 8, Q.width) });
    await page.evaluate(() => document.body.classList.add('clip-a'));
    await openPanel(start);
    const side = Math.max(Q.width + 50, Q.y + Q.height + 150 - bar.y);
    const quilt = { x: Q.x + Q.width / 2 - side / 2, y: bar.y - 8, w: side, h: side };

    // 1. Blocks: the quilt grows to 5 × 5, the mirror goes on, and each pick lands everywhere it mirrors to
    const blocks = new Clip(page, 'story_blocks', quilt);
    blocks.square = true;
    blocks.story = true;
    await blocks.start();
    await blocks.hold(450);
    const stepper = (k, n, ms) =>
      (async () => {
        await blocks.moveTo(page.locator(`[data-step="${k}"]`), ms);
        for (let i = 0; i < n; i++) {
          await blocks.quickClick();
          await page.waitForTimeout(80);
        }
      })();
    await stepper('c:1', 2, 280);
    await stepper('r:1', 4, 240);
    // the real size, and the mirror: both in one move, out of the picture
    await page.evaluate(() => {
      const size = document.getElementById('dz-bmm3');
      size.value = '458';
      size.dispatchEvent(new Event('input', { bubbles: true }));
      size.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('rail-sym').click();
      document.querySelector('.sym-opt[data-sym="kal"]').click();
    });
    await page.waitForTimeout(200);
    const d5 = { ...start, cols: 5, rows: 5, blockMm: 458, blocks: new Array(25).fill(0).map(() => newBlock('plain')) };
    const pick = async (i, key, ms) => {
      const s = await blockSpot(page, d5, i);
      await blocks.move(s.x, s.y, ms);
      await blocks.quickClick();
      const tile = page.locator(`#dz-patterns [data-p="${key}"]`);
      await tile.evaluate(el => el.scrollIntoView({ block: 'nearest', inline: 'center' }));
      await blocks.moveTo(tile, ms);
      await blocks.quickClick();
      await page.waitForTimeout(100);
    };
    await pick(1, 'geese', 300);
    await pick(0, 'sawstar', 220);
    await pick(2, 'nine', 170);
    await pick(6, 'ohio', 170);
    await pick(7, 'hst', 170);
    await pick(12, 'twisted', 170);
    await blocks.move(quilt.x + quilt.w + 40, quilt.y + quilt.h - 40, 200);
    await blocks.hold(650);
    blocks.encode();

    // 2. Fabrics: part by part, and the photo of a fabric from the shelf
    await page.evaluate(() => document.body.classList.replace('clip-a', 'clip-b'));
    await page.waitForTimeout(200);
    const fabrics = new Clip(page, 'story_fabrics', quilt);
    fabrics.square = true;
    fabrics.story = true;
    await fabrics.start();
    fabrics.pt = { x: quilt.x + quilt.w + 40, y: quilt.y + quilt.h - 40 };
    await fabrics.pointer();
    await fabrics.hold(250);
    const swap = async (i, pattern, role, fabric, ms) => {
      const s = await blockSpot(page, d5, i);
      await fabrics.move(s.x, s.y, ms);
      await fabrics.quickClick();
      await page.waitForTimeout(120);
      const part = await partSpot(page, pattern, role);
      await fabrics.move(part.x, part.y, ms);
      await fabrics.quickClick(() => page.mouse.dblclick(fabrics.pt.x, fabrics.pt.y));
      const tile = page.locator(`#dz-fabrics2 .fab[data-f="${fabric}"]`);
      await tile.evaluate(el => el.scrollIntoView({ block: 'nearest', inline: 'center' }));
      await fabrics.moveTo(tile, ms);
      await fabrics.quickClick();
      await page.waitForTimeout(250);
    };
    await swap(2, 'nine', 1, RED, 240);
    await swap(6, 'ohio', 1, RED, 200);
    await swap(12, 'twisted', 1, RED, 200);
    await swap(7, 'hst', 1, photo, 240);
    await fabrics.move(quilt.x + quilt.w + 40, quilt.y + quilt.h - 40, 200);
    await fabrics.hold(700);
    fabrics.encode();

    // 3. What to buy and cut: the fabrics with their metres, then the PDF's real-size template
    await page.evaluate(() => document.body.classList.add('clip-c'));
    await page.locator('#tabs [data-page="cut"]').click();
    await page.locator('#cg-blocks .cgblock').first().waitFor();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(700);
    const list = await page.locator('#cg-fabrics').boundingBox();
    const pdfBtn = await page.locator('#cg-pdf').boundingBox();
    const cutSide = Math.max(list.width + 40, pdfBtn.y + pdfBtn.height + 16 - list.y + 16);
    const cam = { x: Math.max(0, list.x + list.width / 2 - cutSide / 2), y: list.y - 12, w: cutSide, h: cutSide };
    const cut = new Clip(page, 'story_cut', cam);
    cut.square = true;
    cut.story = true;
    await cut.start();
    await cut.hold(1000);
    // over to a block: a click opens its cut list, and each cut lights up its pieces on the block
    const card = page.locator('#cg-blocks .cgblock').first();
    const pic = await card.locator('canvas').boundingBox();
    const head = await card.locator('h3').boundingBox();
    const blockSide = pic.width + 350; // room for the whole cut list under it
    await cut.camera({ x: pic.x + pic.width / 2 - blockSide / 2, y: head.y - 14, w: blockSide, h: blockSide }, 520);
    await cut.move(pic.x + pic.width / 2, pic.y + pic.height * 0.62, 300);
    await cut.quickClick();
    await cut.tween(420, () => {}); // the list slides open
    const cuts = card.locator('.cg-list tbody tr');
    for (const [row, ms] of [
      [3, 300], // the blue triangles
      [2, 220], // the centre square
      [1, 220], // the corner squares
    ]) {
      await cut.moveTo(cuts.nth(row), ms);
      await page.waitForTimeout(150);
      await cut.hold(460);
    }
    // back to the PDF button
    await cut.moveTo(page.locator('#cg-pdf'), 520, cam);
    const pdf = path.join(WORK, 'story.pdf');
    await cut.quickClick(async () => {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 120_000 }),
        page.locator('#cg-pdf').click(),
      ]);
      await dl.saveAs(pdf);
    });
    const dir = path.join(WORK, 'story-pages');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
    execFileSync('pdftoppm', ['-r', '120', '-jpeg', pdf, path.join(dir, 'p')]);
    const names = fs.readdirSync(dir).sort();
    // the last two pages: the big template of the last block, on two sheets
    await page.evaluate(
      ({ a, b, cam }) => {
        const H = cam.h * 0.9,
          W = (H * 210) / 297,
          s = document.createElement('div');
        s.id = 'clip-sheets';
        s.style.cssText = `position:fixed;left:${cam.x}px;top:${cam.y}px;width:${cam.w}px;height:${cam.h}px;z-index:99990;background:#fbf3e8;opacity:0;overflow:hidden`;
        const img = (u, clip) =>
          `<img src="${u}" class="sh" style="position:absolute;left:50%;top:50%;height:${H * Math.min(1, (cam.w * 0.96) / (2 * W * 0.9619))}px;clip-path:${clip};filter:drop-shadow(0 6px 12px rgba(70,40,20,.28))">`;
        s.innerHTML = img(a, 'inset(0 3.81% 0 0)') + img(b, 'inset(0 0 0 3.81%)');
        document.body.append(s);
        document.getElementById('clip-cursor').style.display = 'none';
        window.__sheets = (o, t) => {
          s.style.opacity = o;
          const [l, r] = s.querySelectorAll('.sh');
          const half = l.offsetWidth * (0.5 - 0.0381);
          l.style.transform = `translate(-50%, -50%) translate(${-half - 70 * (1 - t)}px, ${16 * (1 - t)}px) rotate(${-3 * (1 - t)}deg)`;
          r.style.transform = `translate(-50%, -50%) translate(${half + 70 * (1 - t)}px, ${-16 * (1 - t)}px) rotate(${3 * (1 - t)}deg)`;
        };
        return Promise.all([...s.querySelectorAll('img')].map(i => i.decode()));
      },
      { a: uri(path.join(dir, names.at(-2))), b: uri(path.join(dir, names.at(-1))), cam },
    );
    await cut.tween(260, t => page.evaluate(a => window.__sheets(...a), [t, 0]));
    await cut.tween(650, t => page.evaluate(a => window.__sheets(...a), [1, t]));
    await cut.hold(800);
    cut.encode();
    await page.evaluate(() => {
      document.getElementById('clip-sheets').remove();
      document.getElementById('clip-cursor').style.display = '';
    });

    // 4. On the bed: this same quilt
    await page.locator('#tabs [data-page="design"]').click();
    await page.waitForTimeout(400);
    const { openSim, drop } = simTools(page);
    await openSim('us-queen', 1.1);
    const b = await page.locator('#stage').boundingBox();
    const bedSide = Math.min(b.width, b.height);
    const bed = new Clip(page, 'story_bed', {
      x: b.x + (b.width - bedSide) / 2,
      y: b.y + (b.height - bedSide) / 2,
      w: bedSide,
      h: bedSide,
    });
    bed.square = true;
    bed.story = true;
    await bed.start({ pointer: false });
    await drop(bed, 2.0, 1.3);
    const cx = b.x + b.width / 2,
      cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await bed.tween(1000, t => page.mouse.move(cx + 60 * t, cy));
    await page.mouse.up();
    await bed.hold(350);
    bed.encode();
    await browser.close();
  },

  // The "Draw your own" card of the welcome page, in the block editor, mirrored four ways: a Sawtooth star on the grid
  // of cells, then a star with slanted seams on graph paper. Square and close on the drawing with the shapes and fabrics
  // under it, and no words, so it suits every language.
  async draw() {
    const plain = () => newBlock('plain', [CREAM]);
    const d = heroDesign({ corner: plain, edge: plain, inner: plain });
    const { browser, page } = await openApp(d, { viewport: { width: 1000, height: 900 } });
    await page.addStyleTag({
      content: `
      .drawblk { width: 490px !important; padding: 14px !important; overflow: hidden !important; }
      .drawblk .dlg-head, #drawblk-mode, .drawblk-side > :not(#drawblk-cells-tools, :has(#drawblk-roles)), #drawblk-cells-tools .lbl, #drawblk-tools .wide, .drawblk-side .lbl, #drawblk-tools [data-tool="v"], #drawblk-tools [data-tool="<"], #drawblk-tools [data-tool=">"], .drawblk-role:nth-child(n + 4) { display: none !important; }
      .drawblk-paper { width: 400px; margin: 0 auto; }
      .drawblk-body { grid-template-columns: 1fr !important; gap: 12px !important; margin: 0 !important; }
      .drawblk-side { flex-direction: row !important; align-items: center; justify-content: space-between; gap: 14px !important; }
      .drawblk-side > :has(#drawblk-roles) { margin-left: auto; }
      #drawblk-cells-tools { flex: 1 1 0; }
      #drawblk-tools button { height: 44px; padding: 0 !important; font-size: 1.2rem !important; }
      .drawblk-role { width: 44px !important; height: 44px !important; }`,
    });
    const at0 = await blockSpot(page, d, 0);
    await page.mouse.click(at0.x, at0.y);
    await page.locator('#dz-patterns').hover();
    await page.locator('#fab-more-float').click();
    await page.locator('#blklib-draw').click();
    await page.locator('#drawblk').waitFor();
    await page.evaluate(() => {
      const sym = document.getElementById('drawblk-sym'); // out of the picture
      sym.value = 'mirror';
      sym.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.mouse.move(2, 2);
    await page.waitForTimeout(400);
    const box = await page.locator('#drawblk').boundingBox();
    const side = Math.max(box.width, box.height) - 8; // inside the dialog's stitched edge
    const clip = new Clip(page, 'draw', {
      x: box.x + box.width / 2 - side / 2,
      y: box.y + box.height / 2 - side / 2,
      w: side,
      h: side,
    });
    clip.square = true;
    await clip.start();
    await clip.hold(500);
    const grid = await page.locator('#drawblk-canvas').boundingBox();
    const cell = (x, y) => [grid.x + (x / 4) * grid.width, grid.y + (y / 4) * grid.height];
    const pick = async selector => {
      await clip.moveTo(page.locator(selector), 420);
      await clip.click();
    };
    const place = async (x, y) => {
      await clip.move(...cell(x, y), 420);
      await clip.click();
      await clip.hold(220);
    };
    await pick('#drawblk-roles [data-role="1"]');
    await pick('#drawblk-tools [data-tool="\\\\"]');
    await place(1.2, 0.8); // the star's points at the top, and by the mirror at the bottom
    await place(0.8, 1.2); // its points at the sides
    await pick('#drawblk-roles [data-role="2"]');
    await pick('#drawblk-tools [data-tool="s"]');
    await place(1.5, 1.5); // its middle
    await clip.move(box.x + box.width + 40, box.y + box.height + 40, 400);
    await clip.hold(900);

    // graph paper: seams at any angle, which cells can't do; the tools have words, so they stay out of the picture
    await page.evaluate(() => {
      const veil = document.createElement('div');
      veil.id = 'clip-veil';
      veil.style.cssText = `position:absolute;inset:0;z-index:5;pointer-events:none;background:#fef9f1;opacity:0`;
      document.getElementById('drawblk').append(veil);
    });
    const veil = o => page.evaluate(v => (document.getElementById('clip-veil').style.opacity = v), o);
    const inPicture = sel => page.locator(sel).evaluate(b => b.click());
    await clip.tween(220, t => veil(t));
    await inPicture('#drawblk-mode [data-mode="paper"]');
    await inPicture('#drawblk-clear');
    await page.waitForTimeout(150);
    await clip.tween(220, t => veil(1 - t));
    const RULER = 24; // the editor's rulers along the top and left
    const onPaper = (x, y) => [
      grid.x + RULER + (x / 4) * (grid.width - RULER),
      grid.y + RULER + (y / 4) * (grid.height - RULER),
    ];
    const seam = async (x0, y0, x1, y1) => {
      await clip.move(...onPaper(x0, y0), 340);
      await page.mouse.down();
      const [ax, ay] = onPaper(x0, y0),
        [bx, by] = onPaper(x1, y1);
      await clip.tween(380, async t => {
        clip.pt = { x: mix(ax, bx, t), y: mix(ay, by, t) };
        await clip.pointer();
        await page.mouse.move(clip.pt.x, clip.pt.y);
      });
      await page.mouse.up();
      await clip.hold(120);
    };
    await seam(0, 0, 2, 1); // a slanted seam from the corner, and its mirror images
    await seam(0, 0, 1, 2);
    await seam(1, 2, 2, 1); // the diamond in the middle
    await inPicture('#drawblk-ptools [data-ptool="fill"]');
    const color = async (x, y) => {
      await clip.move(...onPaper(x, y), 380);
      await clip.click();
      await clip.hold(180);
    };
    await pick('#drawblk-roles [data-role="1"]');
    await color(1, 1); // the star's four points
    await pick('#drawblk-roles [data-role="2"]');
    await color(2, 2); // its middle
    await clip.move(box.x + box.width + 40, box.y + box.height + 40, 400);
    await clip.hold(1400);
    clip.encode();
    await browser.close();
  },

  // Pick blocks (every pick lands in all its mirror places at once), then swap a fabric: the whole quilt follows.
  async block() {
    const plain = () => newBlock('plain', [CREAM]);
    const d = heroDesign({ corner: plain, edge: plain, inner: plain });
    const { browser, page } = await openApp(d, { recent: ['ohio', 'geese', 'sawstar'] });
    await page.addStyleTag({ content: COMPACT });
    const c0 = await blockSpot(page, d, 12);
    await page.mouse.click(c0.x, c0.y);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(500);
    const clip = new Clip(page, 'block', WHOLE_WITH_PANEL);
    await clip.start();
    await clip.hold(450);
    const pick = async (i, key) => {
      const s = await blockSpot(page, d, i);
      await clip.move(s.x, s.y, 330);
      await clip.click();
      const tile = page.locator(`#dz-patterns [data-p="${key}"]`);
      await clip.reveal(tile);
      await clip.moveTo(tile, 330);
      await clip.click();
      await page.waitForTimeout(120);
      await clip.hold(200);
    };
    await pick(1, 'geese');
    await pick(0, 'sawstar');
    await pick(6, 'ohio');
    // the star's points, all at once (double-click), then a new fabric for them
    const part = await partSpot(page, 'ohio', 1);
    await clip.move(part.x, part.y, 380);
    await clip.click(() => page.mouse.dblclick(clip.pt.x, clip.pt.y));
    const fab = page.locator(`#dz-fabrics2 .fab[data-f="${RED}"]`);
    await clip.reveal(fab);
    await clip.moveTo(fab, 380);
    await clip.click();
    await page.waitForTimeout(200);
    await clip.hold(350);
    await clip.move(WHOLE_WITH_PANEL.x + 1120, WHOLE_WITH_PANEL.y + 800, 450);
    await clip.hold(900);
    clip.encode();
    await browser.close();
  },

  // From the quilt to the list of every piece (each row lights up its pieces), then the PDF: its real pages, and a
  // big template that takes two A4 sheets, joined at their + marks.
  async cut() {
    const { browser, page } = await openApp(heroDesign(), { viewport: { width: 1300, height: 812 } });
    const clip = new Clip(page, 'cut', { x: 0, y: 0, w: 1300, h: 812 });
    await clip.start();
    await clip.hold(350);
    await clip.moveTo(page.locator('#tabs [data-page="cut"]'), 420);
    await clip.click();
    const first = page.locator('#cg-blocks .cgblock').first();
    await first.waitFor();
    await page.waitForTimeout(500);
    await clip.hold(200);
    await clip.moveTo(first.locator('h3'), 400);
    await clip.click();
    await page.waitForTimeout(600);
    await clip.hold(120);
    const rows = first.locator('.cg-list tbody tr');
    await clip.moveTo(rows.nth(3), 380); // the blue triangles
    await page.waitForTimeout(150);
    await clip.hold(420);
    await clip.moveTo(rows.nth(2), 240); // the centre square
    await page.waitForTimeout(150);
    await clip.hold(420);
    await clip.moveTo(page.locator('#cg-pdf'), 420);
    const pdf = path.join(WORK, 'cut.pdf');
    await clip.click(async () => {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 120_000 }),
        page.locator('#cg-pdf').click(),
      ]);
      await dl.saveAs(pdf);
    });
    fs.rmSync(path.join(WORK, 'cut-pages'), { recursive: true, force: true });
    fs.mkdirSync(path.join(WORK, 'cut-pages'));
    execFileSync('pdftoppm', ['-r', '120', '-jpeg', pdf, path.join(WORK, 'cut-pages', 'p')]);
    const names = fs.readdirSync(path.join(WORK, 'cut-pages')).sort();
    // the fabrics, the whole quilt, the last block; then the two sheets of its template
    const pick = [0, 1, 7, 8, 9].map(i => uri(path.join(WORK, 'cut-pages', names[i])));
    await page.evaluate(
      ({ urls, tag }) => {
        const s = document.createElement('div');
        s.id = 'clip-sheets';
        s.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#fbf3e8;opacity:0;overflow:hidden';
        s.innerHTML =
          urls
            .map(
              (u, i) =>
                `<div class="sh" style="position:absolute;left:0;top:0;filter:drop-shadow(0 8px 18px rgba(70,40,20,.28));opacity:0"><img src="${u}" style="display:block;height:${i < 3 ? 620 : 730}px;${i === 3 ? 'clip-path:inset(0 3.81% 0 0)' : i === 4 ? 'clip-path:inset(0 0 0 3.81%)' : ''}"></div>`,
            )
            .join('') +
          `<div id="clip-tag" style="position:absolute;right:44px;bottom:36px;background:#b5532f;color:#fff;font:700 44px Karla,system-ui,sans-serif;padding:10px 26px;border-radius:12px;opacity:0">${tag}</div>`;
        document.body.append(s);
        window.__sheets = (o, list, tag) => {
          s.style.opacity = o;
          document.getElementById('clip-tag').style.opacity = tag;
          s.querySelectorAll('.sh').forEach((el, i) => {
            const a = list[i];
            el.style.opacity = a.o;
            el.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -50%) rotate(${a.r}deg)`;
          });
        };
        return Promise.all([...s.querySelectorAll('img')].map(i => i.decode()));
      },
      { urls: pick, tag: T.realSize },
    );
    await page.evaluate(() => (document.getElementById('clip-cursor').style.display = 'none'));
    const W = (730 * 210) / 297; // a template sheet on screen
    const hide = { x: 0, y: 0, r: 0, o: 0 };
    const part = (t, k) => ease(Math.min(1, Math.max(0, (t - k * 0.16) / 0.68)));
    const fan = t => [
      { x: 345, y: mix(1200, 430, part(t, 0)), r: mix(-14, -7, part(t, 0)), o: 1 },
      { x: 650, y: mix(1200, 405, part(t, 1)), r: 0, o: 1 },
      { x: 955, y: mix(1200, 430, part(t, 2)), r: mix(14, 7, part(t, 2)), o: 1 },
    ];
    const set = (o, list, tag = 0) => page.evaluate(([o, l, g]) => window.__sheets(o, l, g), [o, list, tag]);
    await clip.tween(800, t => set(Math.min(1, t * 3), [...fan(t), hide, hide]));
    const poster = clip.n;
    await clip.hold(450);
    const sheets = (t, o) => {
      const half = W * (0.5 - 0.0381); // each sheet trimmed along its dotted border, so they meet at the + marks
      return [
        { x: 650 - half - mix(120, 0, t), y: 406 + mix(36, 0, t), r: mix(-3.5, 0, t), o },
        { x: 650 + half + mix(120, 0, t), y: 406 - mix(36, 0, t), r: mix(3.5, 0, t), o },
      ];
    };
    await clip.tween(320, t => {
      const f = fan(1).map(s => ({ ...s, o: 1 - t }));
      return set(1, [...f, ...sheets(0, t)]);
    });
    await clip.tween(800, t => set(1, [hide, hide, hide, ...sheets(t, 1)]));
    await clip.tween(300, t => set(1, [hide, hide, hide, ...sheets(1, 1)], t));
    await clip.hold(1500);
    clip.encode({ posterAt: poster });
    await browser.close();
  },

  // A phone takes a picture of a fabric on the shelf; the photo goes in the library, with the width it covers in real
  // life; on the quilt, its print keeps that size: a ruler over the block shows it.
  async fabric() {
    const FAB = path.join(APP, 'assets', 'fabric');
    const mine = recolour('my-paisley.jpg', 'paisley.jpg', 'hue=h=150:s=1.25,eq=contrast=1.15:brightness=-0.02');
    const stripe = recolour('my-stripe.jpg', 'stripe.jpg', 'hue=h=190:s=1.1');
    const linen = recolour('my-linen.jpg', 'linen.jpg', 'hue=h=120:s=0.7,eq=brightness=0.08');
    const CM = 35;
    const d = heroDesign();
    const { browser, page } = await openApp(d, {
      photos: [
        { file: stripe, name: T.stripe, cm: 20 },
        { file: linen, name: T.linen, cm: 25 },
      ],
    });
    await page.addStyleTag({ content: COMPACT });
    // the big triangles of the half-square blocks are chosen; the library is open on "My photos"
    const s7 = await blockSpot(page, d, 7);
    await page.mouse.click(s7.x, s7.y);
    await page.waitForTimeout(400);
    const tri = await partSpot(page, 'hst', 1);
    await page.mouse.dblclick(tri.x, tri.y);
    await page.waitForTimeout(200);
    await page.locator('#dz-fabrics2').hover();
    await page.locator('#fab-more-float').click();
    await page.locator('#fablib-groups button[data-g="mine"]').click();
    await page.waitForTimeout(300);
    const dlg = await page.locator('#fablib').boundingBox();
    const cam = { x: dlg.x - 20, y: dlg.y - 10, w: dlg.width + 40, h: (dlg.width + 40) / 1.6 };
    const clip = new Clip(page, 'fabric', cam);
    await clip.start();
    // the shelf: folded fabrics, drawn over the page, and a phone that takes a picture of one of them
    const tex = {
      paisley: uri(mine),
      stripe: uri(stripe),
      linen: uri(linen),
      red: uri(path.join(FAB, 'linen.jpg')),
      weave: uri(path.join(FAB, 'weave.jpg')),
      wood: uri(path.join(APP, 'assets', 'wood_color.jpg')),
    };
    await page.evaluate(
      ({ tex, cam }) => {
        const k = cam.w / 800; // the drawing is laid out for a frame 800 wide
        const solid = c => `background:url(${tex.weave}) center/200px,${c};background-blend-mode:multiply`;
        const print = u => `background:url(${u}) center/${240 * k}px`;
        const looks = {
          I: solid('#3b5788'),
          M: solid('#d9ad58'),
          C: solid('#f6eddb'),
          S: solid('#8fa37f'),
          O: solid('#c27a6c'),
          P: print(tex.paisley),
          T: print(tex.stripe),
          L: print(tex.linen),
          R: print(tex.red),
        };
        const css = document.createElement('style');
        css.textContent =
          Object.entries(looks)
            .map(([f, s]) => `.clip-fold-${f}{${s}}`)
            .join('') +
          `.clip-fold{position:absolute;width:${150 * k}px;height:${42 * k}px;border-radius:${8 * k}px ${20 * k}px ${20 * k}px ${8 * k}px;box-shadow:inset 0 ${-9 * k}px ${10 * k}px rgba(30,15,5,.38),inset 0 ${5 * k}px ${5 * k}px rgba(255,255,255,.22),0 ${2 * k}px ${3 * k}px rgba(30,15,5,.35)}
           .clip-plank{position:absolute;left:0;right:0;height:${26 * k}px;background:url(${tex.wood}) center/${500 * k}px;box-shadow:0 ${8 * k}px ${14 * k}px rgba(40,20,5,.35)}`;
        document.head.append(css);
        const stack = (x, base, kinds) =>
          [...kinds]
            .map((f, i) => {
              const y = base - (i + 1) * 40 * k,
                dx = ((i * 37) % 9) - 4;
              return `<div class="clip-fold clip-fold-${f}" ${f === 'P' ? 'data-hero' : ''} style="left:${(x + dx) * k}px;top:${y}px"></div>`;
            })
            .join('');
        const plank = y => `<div class="clip-plank" style="top:${y}px"></div>`;
        const y1 = cam.h * 0.46,
          y2 = cam.h * 0.93;
        const shelf =
          plank(y1) +
          plank(y2) +
          stack(40, y1, 'ICSM') +
          stack(225, y1, 'OLCI') +
          stack(410, y1, 'MSPT') +
          stack(595, y1, 'RCSO') +
          stack(40, y2, 'SIMC') +
          stack(225, y2, 'TCOR') +
          stack(410, y2, 'CLIM') +
          stack(595, y2, 'OSTC');
        const st = document.createElement('div');
        st.id = 'clip-stage';
        st.popover = 'manual';
        st.style.cssText = `position:fixed;left:${cam.x}px;top:${cam.y}px;width:${cam.w}px;height:${cam.h}px;margin:0;padding:0;border:0;overflow:hidden;background:#f3e6d3`;
        // the phone: its screen is the shelf again, seen through the camera
        const PW = 204 * k,
          PH = 410 * k,
          B = 9 * k,
          SW = PW - 2 * B,
          SH = PH - 2 * B;
        const fill = 'position:absolute;inset:0';
        const c = 'linear-gradient(#fff,#fff)',
          l = 22 * k,
          w = 3 * k;
        const brackets = [
          `${c} 0 0/${l}px ${w}px`,
          `${c} 0 0/${w}px ${l}px`,
          `${c} 100% 0/${l}px ${w}px`,
          `${c} 100% 0/${w}px ${l}px`,
          `${c} 0 100%/${l}px ${w}px`,
          `${c} 0 100%/${w}px ${l}px`,
          `${c} 100% 100%/${l}px ${w}px`,
          `${c} 100% 100%/${w}px ${l}px`,
        ].join(',');
        st.innerHTML = `${shelf}<div id="clip-phone" style="position:absolute;left:0;top:0;width:${PW}px;height:${PH}px;background:#16120f;border-radius:${30 * k}px;box-shadow:0 ${14 * k}px ${34 * k}px rgba(30,15,5,.5),inset 0 0 0 ${1.5 * k}px #4a423c">
          <div style="position:absolute;left:${B}px;top:${B}px;width:${SW}px;height:${SH}px;border-radius:${22 * k}px;overflow:hidden;background:#f3e6d3">
            <div id="clip-world" style="position:absolute;left:0;top:0;width:${cam.w}px;height:${cam.h}px;transform-origin:0 0">${shelf}</div>
            <div id="clip-flat" style="${fill};opacity:0;background:url(${tex.paisley}) center/${360 * k}px"></div>
            <div id="clip-focus" style="position:absolute;left:18%;top:24%;width:64%;height:36%;opacity:0;background:${brackets};background-repeat:no-repeat"></div>
            <div style="position:absolute;left:0;right:0;bottom:0;height:${84 * k}px;background:rgba(15,10,8,.62)"></div>
            <div style="position:absolute;left:50%;bottom:${16 * k}px;width:${52 * k}px;height:${52 * k}px;margin-left:${-26 * k}px;border-radius:50%;background:#fff;box-shadow:0 0 0 ${3 * k}px #16120f,0 0 0 ${6 * k}px #fff"></div>
            <div id="clip-touch" style="position:absolute;left:50%;bottom:${16 * k}px;width:${52 * k}px;height:${52 * k}px;margin-left:${-26 * k}px;border-radius:50%;background:rgba(181,83,47,.6);opacity:0"></div>
            <div id="clip-flash" style="${fill};background:#fff;opacity:0"></div>
          </div>
          <div style="position:absolute;left:50%;top:${15 * k}px;width:${58 * k}px;height:${13 * k}px;margin-left:${-29 * k}px;border-radius:${7 * k}px;background:#16120f"></div>
        </div>`;
        const pol = document.createElement('div');
        pol.id = 'clip-polaroid';
        pol.popover = 'manual';
        pol.style.cssText = `position:fixed;left:0;top:0;margin:0;border:0;background:#fff;padding:${10 * k}px ${10 * k}px ${30 * k}px;box-shadow:0 ${8 * k}px ${22 * k}px rgba(30,15,5,.4);overflow:visible;opacity:0`;
        pol.innerHTML = `<img src="${tex.paisley}" style="display:block;width:${220 * k}px;height:${220 * k}px">`;
        document.documentElement.append(st, pol);
        let hx = 0,
          hy = 0; // the fabric the phone looks at: measured once the drawing is on screen
        const set = (id, v) => (document.getElementById(id).style.opacity = v);
        window.__phone = ({ y = 0, zoom = 1.6, flat = 0, focus = 0, touch = 0, flash = 0 }) => {
          document.getElementById('clip-phone').style.transform =
            `translate(${hx - PW / 2}px, ${cam.h * 0.5 - PH / 2 + y * cam.h}px)`;
          document.getElementById('clip-world').style.transform =
            `translate(${SW / 2 - hx * zoom}px, ${SH * 0.42 - hy * zoom}px) scale(${zoom})`;
          set('clip-flat', flat);
          set('clip-focus', focus);
          set('clip-touch', touch);
          set('clip-flash', flash);
        };
        window.__polaroid = (x, y, s, r, o) => {
          pol.style.opacity = o;
          pol.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${r}deg) scale(${s})`;
        };
        window.__clipTop = () => {
          for (const id of ['clip-stage', 'clip-polaroid', 'clip-cursor']) {
            const el = document.getElementById(id);
            if (el?.isConnected) {
              if (el.matches(':popover-open')) el.hidePopover();
              el.showPopover();
            }
          }
        };
        window.__clipTop();
        const fold = st.querySelector(':scope > [data-hero]');
        hx = fold.offsetLeft + fold.offsetWidth / 2;
        hy = fold.offsetTop + fold.offsetHeight / 2;
        window.__phone({ y: 1 });
        return Promise.all([...pol.querySelectorAll('img')].map(i => i.decode()));
      },
      { tex, cam },
    );
    await page.waitForTimeout(150);
    await clip.pointer();
    const phone = s => page.evaluate(a => window.__phone(a), s);
    const pol = (x, y, s, r, o) => page.evaluate(a => window.__polaroid(...a), [x, y, s, r, o]);
    const px0 = await page.evaluate(() => {
      const r = document.querySelector('#clip-phone').getBoundingClientRect();
      return r.x + r.width / 2;
    });
    const start = { x: px0, y: cam.y + cam.h * 0.46 };
    const park = { x: cam.x + cam.w - cam.w * 0.13, y: cam.y + cam.h * 0.3 };
    await pol(start.x, start.y, 0.72, 0, 0);
    await clip.hold(300);
    // the phone comes up in front of the shelf, moves in on the fabric, and takes the picture
    await clip.tween(430, t => phone({ y: mix(1, 0, t) }));
    await clip.tween(520, t => phone({ zoom: mix(1.6, 4.4, t), flat: Math.max(0, (t - 0.55) / 0.45) }));
    await clip.tween(170, t => phone({ zoom: 4.4, flat: 1, focus: t }));
    await clip.hold(120);
    const poster = clip.n; // the still that says it best: a phone, a shelf, a fabric in the frame
    await clip.tween(170, t => phone({ zoom: 4.4, flat: 1, focus: 1, touch: t }));
    await clip.tween(130, t => phone({ zoom: 4.4, flat: 1, focus: 1 - t, touch: 1 - t, flash: t }));
    await clip.tween(130, t => phone({ zoom: 4.4, flat: 1, flash: 1 - t }));
    // the photo leaves the phone for the fabric library, as the shelf fades away
    await clip.tween(460, async t => {
      await pol(mix(start.x, park.x, t), mix(start.y, park.y, t), 0.72, mix(0, 5, t), Math.min(1, t * 5));
      await phone({ y: mix(0, 1, t), zoom: 4.4, flat: 1 });
      await page.evaluate(o => (document.getElementById('clip-stage').style.opacity = o), 1 - t);
    });
    await page.evaluate(() => document.getElementById('clip-stage').remove());
    // how wide the photo is in real life: the slider
    const sl = await page.locator('#dz-cm').boundingBox();
    const xAt = v => sl.x + ((v - 5) / 75) * sl.width;
    const y = sl.y + sl.height / 2;
    await clip.move(xAt(25), y, 340);
    await page.mouse.down();
    const a = clip.pt.x;
    await clip.tween(420, async t => {
      clip.pt = { x: mix(a, xAt(CM), t), y };
      await clip.pointer();
      await page.mouse.move(clip.pt.x, y);
    });
    await page.mouse.up();
    await clip.hold(150);
    // add the photo
    await clip.moveTo(page.locator('#fablib-grid .fab-more'), 340);
    const tile = page.locator('#fablib-grid button.fab', { hasText: T.photo });
    await clip.click(async () => {
      await page
        .locator('#dz-upload')
        .setInputFiles({ name: `${T.photo}.jpg`, mimeType: 'image/jpeg', buffer: fs.readFileSync(mine) });
      await tile.waitFor();
    });
    const tb = await tile.boundingBox();
    const to = { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 - 8 };
    await clip.tween(380, t =>
      pol(mix(park.x, to.x, t), mix(park.y, to.y, t), mix(0.72, 0.42, t), mix(5, 0, t), t > 0.82 ? (1 - t) / 0.18 : 1),
    );
    await pol(0, 0, 1, 0, 0);
    await clip.hold(200);
    // on the quilt
    await clip.moveTo(tile, 360);
    await clip.click();
    await page.waitForTimeout(600);
    await clip.camera(WHOLE_WITH_PANEL, 550);
    await clip.hold(350);
    // the print at its real size: a ruler on the quilt, over one of the new triangles
    const box = await page.locator('#dz-quilt').boundingBox();
    const P = blockPlace(d, 7, box.width, box.height);
    const mm = P.w / d.blockMm;
    const px = CM * 10 * mm;
    const ruler = { x: box.x + P.x + P.w * 0.03, y: box.y + P.y + P.h * 0.82 };
    await page.evaluate(
      ({ ruler, px, CM }) => {
        const r = document.createElement('div');
        r.id = 'clip-ruler';
        r.style.cssText = `position:fixed;left:${ruler.x}px;top:${ruler.y}px;width:${px}px;height:11px;border:2px solid #fff;border-top:0;z-index:99990;opacity:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.8))`;
        r.innerHTML = `<b style="position:absolute;left:50%;bottom:9px;transform:translateX(-50%);white-space:nowrap;font:700 20px Karla,system-ui,sans-serif;color:#fff">${CM} cm</b>`;
        document.body.append(r);
      },
      { ruler, px, CM },
    );
    await clip.move(WHOLE_WITH_PANEL.x + 1120, WHOLE_WITH_PANEL.y + 800, 300);
    const near = { w: 416, h: 260, x: box.x + P.x + P.w / 2 - 208, y: box.y + P.y + P.h / 2 - 130 };
    await clip.camera(near, 600);
    await clip.tween(280, t => page.evaluate(o => (document.getElementById('clip-ruler').style.opacity = o), t));
    await clip.hold(1150);
    clip.encode({ posterAt: poster });
    await browser.close();
  },

  // In the bedroom: dropped on a bed, the camera moves around it; then a quilt of the same blocks, made for a table.
  async bed() {
    const { browser, page } = await openApp(heroDesign(), { viewport: { width: 1300, height: 900 } });
    const { openSim, drop: dropOn } = simTools(page);
    await openSim('us-queen', 1.1);
    const b = await page.locator('#stage').boundingBox();
    const clip = new Clip(page, 'bed', { x: b.x, y: b.y, w: b.width, h: b.width / 1.6 });
    clip.cam.y = b.y + (b.height - clip.cam.h) / 2;
    await clip.start({ pointer: false });
    const drop = (seconds, stretch) => dropOn(clip, seconds, stretch);
    await drop(2.0, 1.5);
    const poster = clip.n - 1;
    const cx = b.x + b.width / 2,
      cy = b.y + b.height / 2;
    const orbit = async (dx, ms) => {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await clip.tween(ms, t => page.mouse.move(cx + dx * t, cy));
      await page.mouse.up();
    };
    await orbit(150, 1500);
    // the quilt made for the table: opened afresh, unseen, so the camera is back where it started
    await page.evaluate(async d => {
      const s = globalThis.__quiltStorage;
      s.setSession('current', d);
      await s.flush();
    }, tableDesign());
    await page.reload();
    await page.locator('#page-design').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
    await openSim('tb-rect6', 0.8);
    clip.cam = { x: b.x + b.width * 0.1, y: clip.cam.y + clip.cam.h * 0.14, w: b.width * 0.8, h: clip.cam.h * 0.8 }; // a table is smaller than a bed
    await drop(1.8, 1.2);
    await clip.hold(700);
    clip.encode({ posterAt: poster });
    await browser.close();
  },
  // The first-quilt tutorial (tour/tour.js): one short clip for each step that has one, following one quilt from
  // start to end, in the language of the words on screen. Each is run as tutorial_en and tutorial_pt.
  async tutorial() {
    if (!process.env.CLIP_LANG) {
      for (const lang of ['en', 'pt-BR'])
        execFileSync(process.execPath, [import.meta.filename, 'tutorial'], {
          env: { ...process.env, CLIP_LANG: lang },
          stdio: 'inherit',
        });
      return;
    }
    const d = tutorialDesign();
    const { browser, page } = await openApp(d, { viewport: { width: 1300, height: 900 } });
    await page.addStyleTag({ content: '#tour-start { display: none !important; }' });
    const lang = LANG === 'en' ? 'en' : 'pt';
    const only = process.env.CLIP_ONLY?.split(',');
    const V = { w: 1300, h: 900 };
    /** a camera of the clips' shape around some things on the page, kept inside it */
    const around = async (locs, w = 780) => {
      const boxes = await Promise.all(locs.map(l => l.boundingBox()));
      const x0 = Math.min(...boxes.map(b => b.x)),
        x1 = Math.max(...boxes.map(b => b.x + b.width)),
        y0 = Math.min(...boxes.map(b => b.y)),
        y1 = Math.max(...boxes.map(b => b.y + b.height));
      const W = Math.min(V.w, Math.max(w, x1 - x0 + 80, ((y1 - y0 + 80) * 8) / 5)),
        H = (W * 5) / 8;
      return {
        x: Math.max(0, Math.min(V.w - W, (x0 + x1) / 2 - W / 2)),
        y: Math.max(0, Math.min(V.h - H, (y0 + y1) / 2 - H / 2)),
        w: W,
        h: H,
      };
    };
    /** one clip: the pointer comes in, does what `act` says, and the result is held a moment */
    const clip = async (name, cam, act) => {
      const c = new Clip(page, `tut_${lang}_${name}`, cam);
      c.story = true; // it plays once and stays on its last frame, so no fading out
      await c.start();
      await logoOn(page, cam);
      await page.evaluate(() => window.__clipTop());
      await c.hold(500);
      await act(c);
      await c.hold(1100);
      await page.evaluate(() => {
        document.getElementById('clip-cursor')?.remove();
        document.getElementById('clip-logo')?.remove();
      });
      if (only && !only.includes(name)) return;
      c.encode();
      // the tour only needs the video
      for (const e of ['webm', 'gif', 'jpg']) fs.rmSync(path.join(OUT, `${c.name}.${e}`), { force: true });
    };
    const q = page.locator('#dz-quilt');
    const rowsPlus = page.locator('[data-step="r:1"]');
    // the quilt grows during this clip, so the camera is framed on it at its full height: three rows, measured unseen,
    // then back to one (in a taller window, so all of it fits)
    V.h = 1120;
    await page.setViewportSize({ width: V.w, height: V.h });
    await page.waitForTimeout(300);
    const rowsMinus = page.locator('[data-step="r:-1"]');
    for (let i = 0; i < 2; i++) await rowsPlus.click();
    await page.waitForTimeout(400);
    const grown = await q.boundingBox();
    for (let i = 0; i < 2; i++) await rowsMinus.click();
    await page.waitForTimeout(400);
    const rowsH = Math.min((V.w * 5) / 8, grown.height + 110);
    const rowsW = (rowsH * 8) / 5;
    const rowsCam = {
      x: Math.max(0, Math.min(V.w - rowsW, grown.x + grown.width / 2 - rowsW / 2)),
      y: Math.max(0, grown.y - 70),
      w: rowsW,
      h: rowsH,
    };
    await clip('rows', rowsCam, async c => {
      await c.moveTo(rowsPlus, 800);
      for (let i = 0; i < 2; i++) {
        await c.click();
        await page.waitForTimeout(250);
        await c.hold(350);
      }
    });
    const unit = page.locator('.unit-sw');
    await clip('unit', await around([unit, q]), async c => {
      await c.moveTo(unit, 800);
      await c.click();
      await page.waitForTimeout(300);
    });
    const size = page.locator('#dz-bsize .inch-whole');
    // the box sits below the window with a large quilt: a taller window, for this clip
    V.h = 1120;
    await page.setViewportSize({ width: V.w, height: V.h });
    await page.waitForTimeout(400);
    await clip('size', await around([size], 640), async c => {
      await c.moveTo(size, 800);
      await c.click(async () => {
        await size.click();
        await page.keyboard.press('Control+A');
      });
      await c.hold(250);
      for (const key of ['1', '2']) {
        await page.keyboard.type(key);
        await c.hold(300);
      }
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await c.hold(300);
    });
    V.h = 900;
    await page.setViewportSize({ width: V.w, height: V.h });
    await page.waitForTimeout(400);
    const middle = await blockSpot(page, { ...d, rows: 3, blocks: new Array(9).fill(d.blocks[0]) }, 4);
    await clip('block', await around([q]), async c => {
      await c.move(middle.x, middle.y, 900);
      await c.click();
      await page.waitForTimeout(400);
    });
    const tile = page.locator('#dz-patterns [data-p="nine"]');
    /** the row scrolled to show there's more, and back, with the keys named beside the pointer */
    const scrollRow = async (c, row, lookFor) => {
      const r = await row.boundingBox();
      await c.move(r.x + r.width * 0.6, r.y + r.height / 2, 700);
      await page.evaluate(
        ({ x, y, words }) => {
          const n = document.createElement('div');
          n.id = 'clip-keys';
          n.popover = 'manual';
          n.textContent = words;
          n.style.cssText = `position:fixed;left:${x}px;top:${y}px;margin:0;border:0;padding:8px 12px;border-radius:8px;background:#7a2f12;color:#fff;font:600 18px sans-serif;white-space:nowrap`;
          document.documentElement.append(n);
          n.showPopover();
          window.__clipTop();
        },
        { x: r.x + 8, y: r.y - 46, words: T.scroll },
      );
      await row.evaluate(el => {
        el.style.scrollSnapType = 'none';
        el.style.scrollBehavior = 'auto';
      });
      const start = await row.evaluate(el => el.scrollLeft);
      const far = await row.evaluate(el => Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + 420));
      const to = v => row.evaluate((el, x) => (el.scrollLeft = x), v);
      await c.tween(1100, t => to(mix(start, far, t)));
      await c.hold(350);
      await c.tween(900, t => to(mix(far, start, t)));
      await page.evaluate(() => document.getElementById('clip-keys').remove());
      // the tile to click in the middle of the row, and settled, so the click lands on it
      await c.tween(350, t =>
        lookFor.evaluate((el, t) => {
          const row = el.parentElement,
            rr = row.getBoundingClientRect(),
            er = el.getBoundingClientRect();
          const want = row.scrollLeft + er.left + er.width / 2 - rr.left - rr.width / 2;
          row.scrollLeft += (want - row.scrollLeft) * t;
        }, t),
      );
      await page.waitForTimeout(300);
    };
    await tile.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await page.waitForTimeout(200);
    await clip('pattern', await around([page.locator('#dz-patterns')], 680), async c => {
      await scrollRow(c, page.locator('#dz-patterns'), tile);
      await c.moveTo(tile, 700);
      await c.click();
      await page.waitForTimeout(300);
    });
    const big = page.locator('#dz-block');
    await big.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    await clip('piece', await around([big], 640), async c => {
      const b = await big.boundingBox();
      await c.move(b.x + b.width / 2, b.y + b.height / 2, 900);
      await c.click();
    });
    const fab = page.locator('#dz-fabrics2 [data-f="b3"]');
    await fab.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await page.waitForTimeout(200);
    await clip('fabric', await around([page.locator('#dz-fabrics2')], 680), async c => {
      await scrollRow(c, page.locator('#dz-fabrics2'), fab);
      await c.moveTo(fab, 700);
      await c.click();
    });
    // the side panel moves the quilt: read it again
    const select = await around([q]);
    await clip('select', select, async c => {
      const b = await q.boundingBox();
      await c.move(b.x + 6, b.y + 6, 700);
      await page.mouse.move(c.pt.x, c.pt.y);
      await page.mouse.down();
      await c.move(b.x + b.width - 6, b.y + b.height - 6, 1200);
      await page.mouse.up();
      await c.pointer();
    });
    const lib = page.locator('#dz-library .blib-item[data-src="4"]');
    await lib.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    await clip('copy', await around([q, lib]), async c => {
      await c.moveTo(lib, 900);
      await c.click();
      await page.waitForTimeout(300);
    });
    const sash = page.locator('#rail-sash');
    // the quilt and the whole side panel, where the widths are
    await clip('sash', { x: 300, y: 0, w: 1000, h: 625 }, async c => {
      await c.moveTo(sash, 800);
      await c.click();
      await page.waitForTimeout(400);
      // the widths tried one after the other, as the tutorial asks
      for (const n of [2, 6, 4]) {
        await c.moveTo(page.locator(`#sash-presets button:nth-child(${n})`), 550);
        await c.click();
        await page.waitForTimeout(200);
        await c.hold(350);
      }
    });
    const brd = page.locator('#rail-brd');
    await clip('border', await around([q, brd]), async c => {
      await c.moveTo(brd, 800);
      await c.click();
      await page.waitForTimeout(400);
      const plain = page.locator('.brd-type[data-t="plain"]');
      await c.moveTo(plain, 800);
      await c.click();
      await page.waitForTimeout(300);
    });
    const simTab = page.locator('#dz-sim');
    // as the tutorial does: a single bed, which this size of quilt covers
    await page.evaluate(() => {
      const bed = document.getElementById('bedsel');
      bed.value = 'br-solteiro';
      bed.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await clip('bed', { x: 0, y: 0, w: V.w, h: (V.w * 5) / 8 }, async c => {
      await c.moveTo(simTab, 900);
      await c.click();
      await page.waitForTimeout(600);
      await c.simFrames(2.2);
    });
    await page.locator('#sim-close').click();
    await page.waitForTimeout(400);
    const cutTab = page.locator('#tabs [data-page="cut"]');
    // a quarter-inch seam, as the tutorial sets it
    await page.evaluate(() => {
      const seam = document.getElementById('cg-seam');
      seam.value = '6.4';
      seam.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await clip('cut', { x: 0, y: 0, w: V.w, h: (V.w * 5) / 8 }, async c => {
      await c.moveTo(cutTab, 900);
      await c.click();
      await page.waitForTimeout(800);
      await c.hold(900);
    });
    await browser.close();
  },
};

fs.mkdirSync(WORK, { recursive: true });
const asked = process.argv.slice(2);
for (const name of asked.length ? asked : ['story', 'draw', 'block', 'cut', 'fabric', 'bed']) await CLIPS[name]();
