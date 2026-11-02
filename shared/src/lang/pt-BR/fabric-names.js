// @ts-check
// Portuguese (Brazil): the names of the fabric collection (../../fabric-patterns.js). Its own tables, not part of the
// dictionary: words as short as "red" or "sky" would get in the way of other sentences there. Keyed by the English
// words of fabric-patterns.js; each colour has its own word, so no two fabrics get the same name.

/** The kinds of fabric, as masculine nouns. @type {Record<string, string>} */
const KINDS = {
  Solid: 'Liso',
  Stripe: 'Listrado',
  Pinstripe: 'Risca de giz',
  'Bias stripe': 'Listrado diagonal',
  Gingham: 'Vichy',
  Check: 'Xadrez',
  'Polka dot': 'Poá',
  Ditsy: 'Florzinha miúda',
  Floral: 'Floral',
  Plaid: 'Escocês',
  Chevron: 'Chevron',
  Mottled: 'Mesclado',
  Houndstooth: 'Pied-de-poule',
};

/** The colours, in the masculine or as a noun that doesn't change. @type {Record<string, string>} */
const COLOURS = {
  navy: 'azul-marinho',
  cobalt: 'azul-cobalto',
  sky: 'azul-céu',
  teal: 'azul-petróleo',
  aqua: 'água-marinha',
  sage: 'verde-sálvia',
  olive: 'verde-oliva',
  forest: 'verde-floresta',
  mustard: 'mostarda',
  butter: 'amarelo-manteiga',
  tangerine: 'tangerina',
  coral: 'coral',
  brick: 'tijolo',
  cherry: 'cereja',
  rose: 'rosé',
  blush: 'rosa-chá',
  plum: 'ameixa',
  lavender: 'lavanda',
  chocolate: 'chocolate',
  tan: 'camelo',
  charcoal: 'grafite',
  grey: 'cinza',
  cream: 'creme',
  white: 'branco',

  indigo: 'índigo',
  denim: 'jeans',
  periwinkle: 'azul-pervinca',
  turquoise: 'turquesa',
  mint: 'menta',
  'kelly green': 'verde-bandeira',
  moss: 'verde-musgo',
  lemon: 'amarelo-limão',
  gold: 'dourado',
  peach: 'pêssego',
  rust: 'ferrugem',
  red: 'vermelho',
  wine: 'vinho',
  raspberry: 'framboesa',
  pink: 'rosa',
  violet: 'violeta',
  mauve: 'malva',
  taupe: 'fendi',
  linen: 'linho',
  black: 'preto',

  'royal blue': 'azul-royal',
  cornflower: 'azul-centáurea',
  peacock: 'azul-pavão',
  jade: 'jade',
  emerald: 'esmeralda',
  pine: 'verde-pinheiro',
  lime: 'verde-limão',
  pistachio: 'pistache',
  chartreuse: 'chartreuse',
  sand: 'areia',
  ochre: 'ocre',
  terracotta: 'terracota',
  salmon: 'salmão',
  watermelon: 'melancia',
  scarlet: 'escarlate',
  fuchsia: 'fúcsia',
  magenta: 'magenta',
  orchid: 'orquídea',
  lilac: 'lilás',
  eggplant: 'berinjela',
  heather: 'urze',
  caramel: 'caramelo',
  cinnamon: 'canela',
  cocoa: 'cacau',
  stone: 'pedra',
  pewter: 'estanho',
  marigold: 'calêndula',
  sunflower: 'girassol',
  butterscotch: 'doce de leite',
  cranberry: 'cranberry',
  flamingo: 'flamingo',
  cerulean: 'azul-cerúleo',
  mahogany: 'mogno',
};

/**
 * A fabric's name from its English kind and colours: "Poá azul-marinho sobre branco", or with no background (solid
 * and mottled fabrics) "Liso azul-marinho". @param {string} kind @param {string} colour @param {string} [back]
 */
const fabricName = (kind, colour, back) =>
  back ? `${KINDS[kind]} ${COLOURS[colour]} sobre ${COLOURS[back]}` : `${KINDS[kind]} ${COLOURS[colour]}`;

export { COLOURS, KINDS, fabricName };
