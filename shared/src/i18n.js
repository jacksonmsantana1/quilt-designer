// @ts-check
// Which language the app speaks, and the helpers that put text into it. English stays in the code and is the key to
// the dictionary (lang/pt-BR.js): t('Sign in') gives "Entrar" in Portuguese, and any text the dictionary doesn't have
// shows in English rather than blank.
//
// The language is fixed when the page loads (changing it saves the choice and reloads the page), so t() also works
// for text kept in module-level constants. Node has no page, so tests and the server always start in English.
import { BLOCKS, DICT, PIECES } from './lang/pt-BR.js';

/** @typedef {'en' | 'pt-BR'} Lang */
const LANG_KEY = 'quilt-lang.v1';

/** The language to start in: the one chosen on this device, or else the browser's. @returns {Lang} */
function startLang() {
  if (typeof document === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'pt-BR') return saved;
  } catch (e) {}
  return /^pt\b/i.test(navigator.language || '') ? 'pt-BR' : 'en';
}

/** @type {Lang} */
let lang = startLang();

/** The language in use. @returns {Lang} */
const getLang = () => lang;
/** Changes the language for this page only. For tests: the app saves the choice and reloads. @param {Lang} l */
const setLang = l => {
  lang = l;
};
/** Keeps the choice on this device; it takes effect at the next page load. @param {Lang} l */
function saveLang(l) {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch (e) {}
}

/** @param {string} s @param {Record<string, string | number> | undefined} vars */
const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (whole, k) => (k in vars ? String(vars[k]) : whole)) : s);

/**
 * A sentence in the language in use. Keep sentences whole, with their blanks named, because word order differs:
 * t('Block {n} of {all}', { n, all }), never t('Block') + n.
 * @param {string} text @param {Record<string, string | number>} [vars] @returns {string}
 */
const t = (text, vars) => fill(lang === 'en' ? text : (DICT[text] ?? text), vars);

/**
 * A sentence that depends on a count: tn(n, '{n} block', '{n} blocks'). Portuguese counts 0 as one ("0 bloco"),
 * English as many. {n} is filled in for you.
 * @param {number} n @param {string} one @param {string} many @param {Record<string, string | number>} [vars]
 * @returns {string}
 */
const tn = (n, one, many, vars) => t((lang === 'pt-BR' ? Math.abs(n) < 2 : n === 1) ? one : many, { n, ...vars });

/** A number already written with a dot, with the decimal mark of the language in use. @param {string | number} s */
const comma = s => (lang === 'pt-BR' ? String(s).replace('.', ',') : String(s));
/** toFixed in the language in use: 1.25 is "1,25" in Portuguese. @param {number} v @param {number} digits */
const fix = (v, digits) => comma(v.toFixed(digits));

/** A traditional block's name. @param {string} label @returns {string} */
const blockName = label => (lang === 'en' ? label : (BLOCKS[label] ?? label));

/**
 * A piece's name, which is made of parts joined by " · " ("Triangle · row 2, column 3 · upper left"). Saved drawings
 * keep these names in English (they are the same on every device), so they are put into the language in use when
 * read. A number in a part is written # in the table.
 * @param {string} name @returns {string}
 */
function pieceText(name) {
  if (lang === 'en') return name;
  return name
    .split(' · ')
    .map(part => {
      const place = /^row (\d+), column (\d+)$/.exec(part);
      if (place) return t('row {r}, column {c}', { r: place[1], c: place[2] });
      if (PIECES[part] !== undefined) return PIECES[part];
      /** @type {string[]} */
      const numbers = [];
      const shown = PIECES[part.replace(/\d+/g, d => (numbers.push(d), '#'))];
      return shown === undefined ? part : shown.replace(/#/g, () => numbers.shift() ?? '');
    })
    .join(' · ');
}

export { blockName, comma, fix, getLang, LANG_KEY, pieceText, saveLang, setLang, t, tn };
