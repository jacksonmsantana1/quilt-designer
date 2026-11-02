// @ts-check
// The Portuguese (Brazil) dictionary: English sentence -> Portuguese sentence, one file per part of the app. A sentence
// used in two parts must read the same in both (the unit tests check). To add text, see "Language" in CLAUDE.md.
import blocks from './pt-BR/blocks.js';
import cutting from './pt-BR/cutting.js';
import designer from './pt-BR/designer.js';
import mine from './pt-BR/mine.js';
import pieces from './pt-BR/pieces.js';
import shared from './pt-BR/shared.js';
import sim from './pt-BR/sim.js';
import template from './pt-BR/template.js';
import tour from './pt-BR/tour.js';

/** The parts, by name (the tests compare them). @type {Record<string, Record<string, string>>} */
const PARTS = { cutting, designer, mine, shared, sim, template, tour };
/** @type {Record<string, string>} */
const DICT = Object.assign({}, ...Object.values(PARTS));
/** Traditional block names, and the family names (t(family)) live in `shared`. @type {Record<string, string>} */
const BLOCKS = blocks;
/** The parts of piece names; # stands for a number. @type {Record<string, string>} */
const PIECES = pieces;

export { BLOCKS, DICT, PARTS, PIECES };
