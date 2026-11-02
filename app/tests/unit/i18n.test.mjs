// The language helpers, and that every text in the app has its Portuguese.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockName, comma, fix, getLang, pieceText, setLang, t, tn } from '@quilt/shared/i18n.js';
import { BLOCKS, DICT, PARTS, PIECES } from '@quilt/shared/lang/pt-BR.js';
import { PATTERNS, partsOf } from '@quilt/shared/patterns.js';
import { drawnKey } from '@quilt/shared/drawn-blocks.js';
import { paperDef } from '../../src/core/paper-drawing.js';
import { codeStrings, templateStrings } from '../../tools/i18n-strings.mjs';

/** Runs a check in Portuguese, then goes back. @param {() => void} fn */
function inPortuguese(fn) {
  setLang('pt-BR');
  try {
    fn();
  } finally {
    setLang('en');
  }
}

test('tests and the server start in English', () => assert.equal(getLang(), 'en'));

test('English is the text itself, with its blanks filled', () => {
  assert.equal(t('Sign in'), 'Sign in');
  assert.equal(t('Not a known sentence {x}', { x: 3 }), 'Not a known sentence 3');
  assert.equal(tn(1, '{n} thing', '{n} things'), '1 thing');
  assert.equal(tn(0, '{n} thing', '{n} things'), '0 things');
  assert.equal(fix(1.25, 2), '1.25');
  assert.equal(comma('6.4'), '6.4');
  assert.equal(pieceText('Triangle · row 2, column 3 · upper left'), 'Triangle · row 2, column 3 · upper left');
});

test('Portuguese: dictionary, plurals, decimal comma, and English for what is unknown', () => {
  inPortuguese(() => {
    assert.equal(t('Sign in'), 'Entrar');
    assert.equal(t('Not a known sentence {x}', { x: 3 }), 'Not a known sentence 3');
    assert.equal(tn(0, '{n} thing', '{n} things'), '0 thing'); // falls back to English, in the singular like Portuguese
    assert.equal(fix(1.25, 2), '1,25');
    assert.equal(comma('6.4'), '6,4');
    assert.equal(blockName('Pinwheel'), 'Cata-vento');
    assert.equal(blockName('A name no block has'), 'A name no block has');
  });
});

test('a saved piece name reads in Portuguese, numbers and all', () => {
  inPortuguese(() => {
    assert.equal(pieceText('Triangle · row 2, column 3'), 'Triângulo · linha 2, coluna 3');
    assert.match(pieceText('Goose 4'), /^Ganso.*4$/);
    assert.equal(pieceText('A piece someone named'), 'A piece someone named');
  });
});

test('a block drawn in Portuguese is saved with the same English piece names and the same key', () => {
  const paper = { n: 2, lines: [[0, 0, 2, 2]], fills: [[0.5, 1.5, 1]] };
  const english = paperDef(paper, 'Meu bloco');
  inPortuguese(() => {
    const drawnHere = paperDef(paper, 'Meu bloco');
    assert.deepEqual(drawnHere, english);
    assert.equal(drawnKey(drawnHere), drawnKey(english));
    assert.match(drawnHere.extra[0][0], /^Triangle · row /);
  });
});

test('every text of the page has its Portuguese', () => {
  assert.deepEqual(
    templateStrings().filter(s => DICT[s] === undefined),
    [],
  );
});

test('every t() and tn() in the code has its Portuguese', () => {
  const words = /\p{L}{2}/u;
  const missing = codeStrings().filter(s => words.test(s.text) && DICT[s.text] === undefined);
  assert.deepEqual(
    missing.map(s => `${s.file}: ${s.text}`),
    [],
  );
});

test('every block has its name in the table (kept in English on purpose or translated)', () => {
  const missing = Object.values(PATTERNS)
    .map(p => p.en)
    .filter(label => label && BLOCKS[label] === undefined);
  assert.deepEqual(missing, []);
});

test('every part of every piece name is in the table', () => {
  const missing = new Set();
  for (const k of Object.keys(PATTERNS))
    for (const { name } of partsOf(k))
      for (const part of name.split(' · ')) {
        if (/^row \d+, column \d+$/.test(part)) continue;
        if (PIECES[part] === undefined && PIECES[part.replace(/\d+/g, '#')] === undefined) missing.add(part);
      }
  assert.deepEqual([...missing], []);
});

test('each translation keeps the blanks of its English', () => {
  const blanks = s => (s.match(/\{\w+\}/g) || []).sort().join();
  const wrong = Object.entries(DICT).filter(([en, pt]) => blanks(en) !== blanks(pt));
  assert.deepEqual(wrong, []);
});

test('a sentence used in two parts of the app reads the same in both', () => {
  const seen = new Map(),
    clash = [];
  for (const [part, table] of Object.entries(PARTS))
    for (const [en, pt] of Object.entries(table)) {
      if (seen.has(en) && seen.get(en).pt !== pt) clash.push(`${en}: "${seen.get(en).pt}" / "${pt}"`);
      else seen.set(en, { part, pt });
    }
  assert.deepEqual(clash, []);
});
