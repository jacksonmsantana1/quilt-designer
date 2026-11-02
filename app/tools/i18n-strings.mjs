// Finds the text that needs a translation: the fixed text of template.html, and every t('…') and tn(n, '…', '…') in
// the code. The unit test app/tests/unit/i18n.test.mjs checks each one is in the dictionary.
//   node app/tools/i18n-strings.mjs template        the template's text, one per line
//   node app/tools/i18n-strings.mjs missing         what the dictionary doesn't have yet
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tidy = s => s.replace(/\s+/g, ' ').trim();
const WORDY = /\p{L}{2}/u; // numbers, symbols and single letters need no translating

const decode = s =>
  s
    .replace(/&times;/g, '×')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&middot;/g, '·')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

/** The fixed text of the page: what ui/translate-page.js looks up. @returns {string[]} */
export function templateStrings() {
  const html = fs.readFileSync(path.join(ROOT, 'app/template.html'), 'utf8');
  const page = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');
  const out = new Set();
  for (const m of page.matchAll(/>([^<>]+)</g)) out.add(tidy(decode(m[1])));
  for (const m of page.matchAll(/\s(?:title|aria-label|placeholder|alt)="([^"]*)"/g)) out.add(tidy(decode(m[1])));
  return [...out].filter(s => WORDY.test(s)).sort();
}

const walk = d =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name === 'lang' ? [] : walk(p);
    return p.endsWith('.js') ? [p] : [];
  });

const LITERAL = String.raw`'(?:[^'\\\n]|\\.)*'|\x60(?:[^\x60\\$]|\\.)*\x60|"(?:[^"\\\n]|\\.)*"`;
const T_CALL = new RegExp(String.raw`(?<![\w.$])t\(\s*(${LITERAL})`, 'g');
const TN_CALL = new RegExp(String.raw`(?<![\w.$])tn\(\s*(?:[^,]|\([^)]*\))+?,\s*(${LITERAL})\s*,\s*(${LITERAL})`, 'g');
// Node reads the literal the way the code means it
const value = lit => (0, eval)(lit); // eslint-disable-line no-eval

/** Every sentence given to t() and tn() in the code. @returns {{ text: string, file: string }[]} */
export function codeStrings() {
  const out = [];
  for (const file of [...walk(path.join(ROOT, 'app/src')), ...walk(path.join(ROOT, 'shared/src'))]) {
    const src = fs.readFileSync(file, 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '');
    for (const m of src.matchAll(T_CALL)) out.push({ text: value(m[1]), file: path.relative(ROOT, file) });
    for (const m of src.matchAll(TN_CALL))
      out.push(
        { text: value(m[1]), file: path.relative(ROOT, file) },
        { text: value(m[2]), file: path.relative(ROOT, file) },
      );
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2];
  if (cmd === 'template') console.log(templateStrings().join('\n'));
  if (cmd === 'missing') {
    const { DICT } = await import(pathToFileURL(path.join(ROOT, 'shared/src/lang/pt-BR.js')).href);
    const list = [...templateStrings().map(text => ({ text, file: 'app/template.html' })), ...codeStrings()].filter(
      s => DICT[s.text] === undefined && WORDY.test(s.text),
    );
    const seen = new Set();
    for (const s of list) if (!seen.has(s.text)) (seen.add(s.text), console.log(`${s.file}: ${s.text}`));
    console.log(`${seen.size} missing`);
  }
}
