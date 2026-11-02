// Draws every block pattern on one page, to check the shapes by eye:
//   node shared/tools/block-sheet.mjs        -> block-sheet.html in the top folder (not kept in git)
// Each colour role gets its default fabric's colour (cream background, indigo main, gold accent, then sage, rose,
// chocolate); thin lines are the seams.
import fs from 'node:fs';
import { PATTERNS, partsOf } from '../src/patterns.js';
import { GRID_BLOCKS } from '../src/blocks.js';
import { ROLE_COLOURS as COLOURS } from '../src/design.js';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = key =>
  `<svg viewBox="-0.01 -0.01 1.02 1.02" role="img" aria-label="${esc(PATTERNS[key].label)}">` +
  partsOf(key)
    .map(
      p =>
        `<polygon points="${p.poly.map(([x, y]) => `${+x.toFixed(5)},${+y.toFixed(5)}`).join(' ')}" fill="${COLOURS[p.role]}"><title>${esc(p.name)}</title></polygon>`,
    )
    .join('') +
  `</svg>`;

const families = {};
for (const [key, p] of Object.entries(PATTERNS)) (families[p.family] ??= []).push(key);
const card = key =>
  `<figure${key in GRID_BLOCKS ? ' class="new"' : ''}>${svg(key)}<figcaption><b>${esc(PATTERNS[key].label)}</b>` +
  `<span>${partsOf(key).length} pieces · ${key}${key in GRID_BLOCKS ? ' · new' : ''}</span></figcaption></figure>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Block sheet</title>
<style>
  :root { --bg: #f7f5f0; --ink: #1d2433; --muted: #5d6475; --line: #d9d4c7; --accent: #2b4a80; }
  @media (prefers-color-scheme: dark) { :root { --bg: #14171f; --ink: #e8e6e1; --muted: #a3a8b5; --line: #343a48; --accent: #93ade4; } }
  body { margin: 0; padding: 24px 16px 48px; background: var(--bg); color: var(--ink); font: 15px/1.45 system-ui, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; } h2 { font-size: 1rem; margin: 28px 0 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  p { color: var(--muted); margin: 0 0 8px; max-width: 70ch; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  figure { margin: 0; padding: 8px; border: 1px solid var(--line); border-radius: 8px; }
  figure.new { border-color: var(--accent); border-width: 2px; padding: 7px; }
  svg { display: block; width: 100%; aspect-ratio: 1; }
  polygon { stroke: rgba(0,0,0,.35); stroke-width: .006; stroke-linejoin: round; }
  figcaption { margin-top: 6px; font-size: .85rem; } figcaption span { display: block; color: var(--muted); font-size: .75rem; }
</style></head><body><main>
<h1>Block sheet</h1>
<p>Every block pattern in the designer, in its default colours: cream background, indigo main, gold accent (and sage, rose and chocolate for blocks with more fabrics). The ${Object.keys(GRID_BLOCKS).length} new blocks have a blue frame. Rest the mouse on a piece to see its name.</p>
${Object.entries(families)
  .map(([f, keys]) => `<h2>${esc(f)}</h2><div class="grid">${keys.map(card).join('')}</div>`)
  .join('\n')}
</main></body></html>
`;
const out = new URL('../../block-sheet.html', import.meta.url);
fs.writeFileSync(out, html);
console.log('wrote', out.pathname.replace(/^\/([A-Z]:)/, '$1'));
