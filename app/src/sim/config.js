// Simulation settings: quilt size, beds, tables and couches, fabric presets and physical parameters.
import '../storage/boot.js'; // load order: runs after storage/boot
import { comma, fix, getLang, t } from '@quilt/shared/i18n.js';

const N = 40; // simulation grid (N × N nodes)
const R = 2 * (N - 1) + 1; // render grid after 4-point subdivision
const SIZE = 2.29; // default: 90-inch queen quilt, metres
const quilt = { w: SIZE, l: SIZE }; // current quilt width (across the bed) and length, metres

// Standard mattress sizes (width × length, mm). Brazil first, then the US sizes most quilt patterns use.
const BEDS = [
  { key: 'br-solteiro', group: 'Brazil', label: 'Solteiro', w: 880, l: 1880 },
  { key: 'br-solteirao', group: 'Brazil', label: 'Solteirão', w: 960, l: 2030 },
  { key: 'br-casal', group: 'Brazil', label: 'Casal padrão', w: 1380, l: 1880 },
  { key: 'br-queen', group: 'Brazil', label: 'Queen', w: 1580, l: 1980 },
  { key: 'br-king', group: 'Brazil', label: 'King', w: 1930, l: 2030 },
  { key: 'us-twin', group: 'United States', label: 'Twin', w: 965, l: 1905 },
  { key: 'us-twinxl', group: 'United States', label: 'Twin XL', w: 965, l: 2030 },
  { key: 'us-full', group: 'United States', label: t('Full / Double'), w: 1370, l: 1905 },
  { key: 'us-queen', group: 'United States', label: 'Queen', w: 1525, l: 2030 },
  { key: 'us-king', group: 'United States', label: 'King', w: 1930, l: 2030 },
  { key: 'us-calking', group: 'United States', label: 'California King', w: 1830, l: 2135 },
  // tables (top width × length, mm; h = height of the top from the floor)
  { key: 'tb-square4', group: 'Tables', kind: 'table', label: t('Square table, 4 seats'), w: 900, l: 900, h: 750 },
  { key: 'tb-rect4', group: 'Tables', kind: 'table', label: t('Rectangular table, 4 seats'), w: 800, l: 1200, h: 750 },
  { key: 'tb-rect6', group: 'Tables', kind: 'table', label: t('Rectangular table, 6 seats'), w: 900, l: 1800, h: 750 },
  { key: 'tb-rect8', group: 'Tables', kind: 'table', label: t('Rectangular table, 8 seats'), w: 1000, l: 2400, h: 750 },
  { key: 'tb-coffee', group: 'Tables', kind: 'table', label: t('Coffee table'), w: 600, l: 1200, h: 450 },
  // couches (width × depth, mm; seat 450 mm, back 850 mm high): the long side runs across, the back away from you
  { key: 'co-armchair', group: 'Couches', kind: 'couch', label: t('Armchair'), w: 950, l: 900, seats: 1 },
  { key: 'co-loveseat', group: 'Couches', kind: 'couch', label: t('Loveseat, 2 seats'), w: 1500, l: 900, seats: 2 },
  { key: 'co-sofa', group: 'Couches', kind: 'couch', label: t('Sofa, 3 seats'), w: 2100, l: 900, seats: 3 },
];
const BED_KEY = 'quilt-bed.v1';
// the first bed is a queen of the person's own country: Brazil's in Portuguese, the United States' otherwise
const bedState =
  getLang() === 'pt-BR'
    ? { key: 'br-queen', kind: 'bed', w: 1580, l: 1980, h: 750, drop: 300, tuck: true }
    : { key: 'us-queen', kind: 'bed', w: 1525, l: 2030, h: 750, drop: 300, tuck: true };
try {
  Object.assign(bedState, JSON.parse(localStorage.getItem(BED_KEY) || '{}'));
} catch (e) {}
const isTableSim = () => bedState.kind === 'table';
const isCouchSim = () => bedState.kind === 'couch';
/** A bed (not a table or a couch): pillows, a head end, the quilt tucked under the pillows. */
const isBedSim = () => !isTableSim() && !isCouchSim();
const bedM = () =>
  isTableSim()
    ? { kind: 'table', w: bedState.w / 1000, l: bedState.l / 1000, h: bedState.h / 1000 }
    : isCouchSim()
      ? { kind: 'couch', w: bedState.w / 1000, l: bedState.l / 1000, seats: bedState.seats || 3 }
      : { w: bedState.w / 1000, l: bedState.l / 1000 };
const bedName = () => {
  const b = BEDS.find(x => x.key === bedState.key);
  return b
    ? b.kind === 'table' || b.kind === 'couch'
      ? b.label.toLowerCase()
      : b.group === 'Brazil'
        ? t('Brazilian {size} bed', { size: b.label.toLowerCase() })
        : t('US {size} bed', { size: b.label.toLowerCase() })
    : isTableSim()
      ? t('custom table')
      : isCouchSim()
        ? t('custom couch')
        : t('custom bed');
};
const WOOD_PARTS = n => n === 'frame' || n === 'headboard' || n === 'tabletop' || n.startsWith('leg');

const PRESETS = {
  cotton: { rhoA: 0.5, E: 3000, G: 60, B: 3e-4, muS: 0.6, muK: 0.5, Cd: 1.2, zeta: 0.05, thickness: 0.02 },
  down: { rhoA: 0.4, E: 2000, G: 40, B: 1.2e-3, muS: 0.45, muK: 0.38, Cd: 1.3, zeta: 0.08, thickness: 0.04 },
  wool: { rhoA: 0.75, E: 1500, G: 30, B: 8e-5, muS: 0.7, muK: 0.6, Cd: 1.2, zeta: 0.05, thickness: 0.008 },
  silk: { rhoA: 0.12, E: 1000, G: 10, B: 3e-6, muS: 0.3, muK: 0.25, Cd: 1.2, zeta: 0.04, thickness: 0.002 },
};
const PARAMS = [
  { key: 'rhoA', label: t('Areal density ρA'), unit: 'kg/m²', min: 0.08, max: 1.2, scale: 'lin', fmt: v => fix(v, 2) },
  { key: 'E', label: t('Tensile stiffness E'), unit: 'N/m', min: 300, max: 30000, scale: 'log', fmt: v => fix(v, 0) },
  { key: 'G', label: t('Shear stiffness G'), unit: 'N/m', min: 3, max: 300, scale: 'log', fmt: v => fix(v, 0) },
  {
    key: 'B',
    label: t('Bending rigidity B'),
    unit: 'N·m',
    min: 1e-6,
    max: 1e-2,
    scale: 'log',
    fmt: v => comma(v.toExponential(1)),
  },
  { key: 'muS', label: t('Static friction μs'), unit: '', min: 0, max: 1.2, scale: 'lin', fmt: v => fix(v, 2) },
  {
    key: 'muK',
    label: t('Kinetic friction μk'),
    unit: '',
    min: 0,
    max: 1.2,
    scale: 'lin',
    fmt: v => fix(v, 2),
    note: t('Capped at μs inside the solver.'),
  },
  { key: 'Cd', label: t('Drag coefficient Cd'), unit: '', min: 0, max: 2, scale: 'lin', fmt: v => fix(v, 2) },
  { key: 'zeta', label: t('Internal damping ratio ζ'), unit: '', min: 0, max: 0.3, scale: 'lin', fmt: v => fix(v, 2) },
  {
    key: 'thickness',
    label: t('Thickness'),
    unit: 'mm',
    min: 0.002,
    max: 0.05,
    scale: 'lin',
    fmt: v => fix(v * 1000, 0),
  },
];
const SUBSTEPS = [10, 20, 40];
const state = {
  params: { ...PRESETS.cotton },
  scenario: 'drop',
  dropHeight: 0.5,
  running: true,
  substeps: 20,
  mode: 'orbit',
  lastStats: null,
  history: [],
  view: 'photo',
  atRest: 'none',
  photoCm: 25,
  page: 'design',
};

export {
  BEDS,
  BED_KEY,
  N,
  PARAMS,
  PRESETS,
  R,
  SIZE,
  SUBSTEPS,
  WOOD_PARTS,
  bedM,
  bedName,
  bedState,
  isBedSim,
  isCouchSim,
  isTableSim,
  quilt,
  state,
};
