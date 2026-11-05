// Guided tour for first-time users.
import '../designer/units-ui.js'; // load order: runs after designer/units-ui
import {
  design,
  focusBlock,
  mineCur,
  selBlocks,
  selParts,
  setFocusBlock,
  setMineCur,
  setSelBlocks,
} from '../core/store.js';
import { hideTools, showToolsPanel, toolsPanel } from '../designer/ui-state.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { IS_PHONE } from '../sim/renderer.js';
import { initFabricLib } from '../designer/fabric-library.js';
import { bordersOf } from '@quilt/shared/geometry.js';
import { getUnit } from '../core/units.js';
import { blockKey } from '../designer/block-library.js';
import { showPage } from '../app/pages.js';
import { confirmLeave, mineSave } from '../mine/my-designs.js';
import { tlKeyFor } from '../timeline/timeline.js';
import { timelines } from '../storage/repo.js';
import { newDesign } from '@quilt/shared/design.js';
import { dispatch, ensureDesign, openDesign, replaceDesign } from '../designer/dispatch.js';
import { removeBorder, setBlockMm, updateBorder } from '../core/edits.js';
import { drawPartsEditor, renderDesigner } from '../designer/parts-editor.js';
import { openBlockEditor } from '../designer/side-panel.js';
import { getLang, t } from '@quilt/shared/i18n.js';

// ---- guided tour: a short exercise for first-time users. Every control is greyed out and switched
// off except the ones the current step needs; the step moves on by itself once it has been done.
const TOUR_KEY = 'quilt-tour.v1';
// a touch screen (a phone or tablet) and no mouse: the cards say "your finger" and "OK" instead of the mouse and Enter
const TOUCH = typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
const tour = {
  on: false,
  i: 0,
  poll: 0,
  saved: null,
  savedCur: null,
  mark: null,
  watching: false,
  steps: [],
  dragged: false,
  zoomed: false,
  brdFab: null,
  bed: '',
  shownAt: 0,
  downAt: 0,
};
const blk = i => design && design.blocks[i];
/** Going back a step: the blocks and panel that step expects. @param {number[]} ids the selected blocks, the first in focus */
function openBlocks(ids, parts = []) {
  setSelBlocks(new Set(ids));
  setFocusBlock(ids[0]);
  selParts.clear();
  for (const p of parts) selParts.add(p);
  renderDesigner();
  openBlockEditor();
}
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8];
/** A step of clicking one of the sashing widths, by its place in the row (their values depend on the unit). @param {number} n */
const sashStep = n => {
  const sel = `#sash-presets button:nth-child(${n})`;
  return {
    allow: ['#sash-presets'],
    glow: sel,
    pick: {
      tile: '#sash-presets button',
      right: `:nth-child(${n})`,
      says: t('That is a different width. Click the highlighted one.'),
    },
    done: () =>
      (design.sashing?.mm || 0) === +(/** @type {HTMLElement} */ (document.querySelector(sel))?.dataset.v ?? -1),
  };
};
const TOUR = [
  {
    title: t('Welcome to Block & Bind!'),
    // a phone shows no videos (tourClip), so its card doesn't promise them
    text: () =>
      innerWidth < 640
        ? t(
            'In about fifteen minutes you will make a real <b>nine-patch quilt</b>, the classic first quilt: a block, sashing and a border, then what to cut, and the quilt on a bed. Each card says what to do, and what to tap is lit up. Nothing you do here can spoil anything.',
          )
        : t(
            'In about fifteen minutes you will make a real <b>nine-patch quilt</b>, the classic first quilt: a block, sashing and a border, then what to cut, and the quilt on a bed. A short video shows each step, then it is your turn. Nothing you do here can spoil anything.',
          ),
    center: true,
    buttons: [
      [t('Start the exercise'), 'next', true],
      [t('Not now'), 'skip'],
    ],
  },
  {
    title: t('Make it three rows'),
    clip: 'rows',
    back: () => hideTools(),
    text: t(
      'A new quilt starts as one row of three blocks. Above the quilt, click the <b>+</b> next to <b>Rows</b> until there are <b>3</b> rows.',
    ),
    allow: ['[data-step="r:1"]', '#dz-rows'],
    glow: '[data-step="r:1"]',
    done: () => design.rows === 3,
  },
  {
    title: t('Measure in inches'),
    clip: 'unit',
    back: () => {
      hideTools();
      const sw = /** @type {HTMLInputElement} */ ($('unit-sw'));
      sw.checked = false;
      sw.dispatchEvent(new Event('change', { bubbles: true }));
    },
    text: t(
      'This exercise is in inches, like most quilt patterns. Above the quilt, click the <b>mm / in</b> switch. If you measure in centimetres, you can switch back to mm at the end, or at any time.',
    ),
    allow: ['.unit-sw'],
    glow: '.unit-sw',
    done: () => getUnit() === 'in',
  },
  {
    title: t('Choose the block size'),
    clip: 'size',
    back: () => hideTools(),
    text: TOUCH
      ? t(
          'Below the quilt, in <b>Block size</b>, type <b>12</b> and tap <b>OK</b> on the keyboard. The old number goes away by itself. Each block will be 12 inches when sewn.',
        )
      : t(
          'Below the quilt, in <b>Block size</b>, type <b>12</b> and press <b>Enter</b>. The old number goes away by itself. Each block will be 12 inches when sewn.',
        ),
    allow: ['#dz-bsize'],
    glow: '#dz-bsize .inch-whole',
    enter: () =>
      setTimeout(() => {
        const box = /** @type {HTMLInputElement | null} */ (document.querySelector('#dz-bsize .inch-whole'));
        if (box) (box.focus(), box.select());
      }),
    done: () => design.blockMm === 305,
    // another size would work, but the cards and videos that follow are about this one
    check: () => design.blockMm !== 254 && design.blockMm !== 305,
    fix: () => {
      dispatch(setBlockMm, 254);
      const box = /** @type {HTMLInputElement | null} */ (document.querySelector('#dz-bsize .inch-whole'));
      if (box) (box.blur(), box.focus());
    },
    says: t('Type <b>12</b>, please, so that the quilt comes out like the one in the videos.'),
  },
  {
    title: t('Open the middle block'),
    clip: 'block',
    back: () => hideTools(),
    text: t('<b>Click the middle block</b> of your quilt. Your block then opens in the <b>Block parts</b> card.'),
    allow: ['#dz-quilt'],
    glow: '#dz-quilt',
    done: () => !$('dz-side').hidden && focusBlock === 4 && selBlocks.size === 1,
    check: () => !$('dz-side').hidden && focusBlock !== 4,
    fix: () => hideTools(),
    says: t('That is another block. Click the block in the middle of the quilt.'),
  },
  {
    title: t('Choose the nine patch'),
    clip: 'pattern',
    back: () => openBlocks([4]),
    text: t('Under <b>Block pattern</b>, click <b>Nine patch</b>: nine squares, the easiest block to sew.'),
    allow: ['#dz-patterns'],
    glow: '#dz-patterns [data-p="nine"]',
    pick: {
      tile: '#dz-patterns .pat',
      right: '[data-p="nine"]',
      says: t(
        'That is a different block. Watch the video again, and when it ends click <b>Nine patch</b>, which will light up.',
      ),
    },
    done: () => blk(4).pattern === 'nine',
  },
  {
    title: t('Pick a square'),
    clip: 'piece',
    back: () => openBlocks([4]),
    text: t('In the big picture of the block, <b>click the square in the middle</b> to select it.'),
    allow: ['#dz-block'],
    glow: '#dz-block',
    keepOff: ['#dz-block'], // every square of it must be in reach
    done: () => selParts.has(4),
    check: () => selParts.size > 0 && !selParts.has(4),
    fix: () => {
      selParts.clear();
      renderDesigner();
      drawPartsEditor();
    },
    says: t('That is another square. Click the square in the middle of the block.'),
  },
  {
    title: t('Give it a fabric'),
    clip: 'fabric',
    back: () => openBlocks([4], [4]), // the square in the middle
    text: t('Now click <b>Mustard cotton</b>, the highlighted fabric, to give it to that square.'),
    allow: ['#dz-fabrics2'],
    glow: '#dz-fabrics2 [data-f="b3"]',
    pick: {
      tile: '#dz-fabrics2 .fab',
      right: '[data-f="b3"]',
      says: t(
        'That is a different fabric. Watch the video again, and when it ends click <b>Mustard cotton</b>, which will light up.',
      ),
    },
    done: s => blk(4).fabrics.join() !== s.f,
    start: () => ({ f: blk(4).fabrics.join() }),
  },
  {
    title: t('Select the whole quilt'),
    clip: 'select',
    back: () => openBlocks([4]),
    text: TOUCH
      ? t(
          'Put your finger on one corner of the quilt and, without lifting it, <b>slide it to the opposite corner</b>. Every block it passes is chosen. A small <b>Unite</b> button will appear: leave it for now.',
        )
      : t(
          'Press and hold the mouse on one corner of the quilt, and <b>drag to the opposite corner</b>. Every block it touches is selected. A small <b>Unite</b> button will appear: leave it for now.',
        ),
    allow: ['#dz-quilt'],
    glow: '#dz-quilt',
    keepOff: ['#dz-quilt'], // both corners must be in sight
    done: () => selBlocks.size === 9,
    // part of the quilt; or a single click, as someone does who has never dragged
    check: () => !tour.down && tour.downAt > tour.shownAt && selBlocks.size < 9,
    says: () =>
      selBlocks.size > 1
        ? t('That took only part of the quilt. Press on one corner and drag all the way to the opposite corner.')
        : TOUCH
          ? t('Keep your finger on the screen while you slide it: from one corner of the quilt to the opposite one.')
          : t(
              'Keep the mouse button pressed while you move the mouse: press on one corner of the quilt and, without letting go, move to the opposite corner. Then let go.',
            ),
  },
  {
    title: t('Copy your block'),
    clip: 'copy',
    back: () => openBlocks(ALL),
    text: t(
      'Under <b>Blocks in your quilt</b>, click your <b>Nine patch</b>, the highlighted one. All nine blocks become a copy of it.',
    ),
    // only your block: dragging made a plain block the current one, and clicking that would wipe out your nine patch
    allow: ['#dz-library'],
    glow: '#dz-library .blib-item[data-src="4"]',
    pick: {
      tile: '#dz-library .blib-item',
      right: '[data-src="4"]',
      says: t(
        'That is a different block, and it would replace your work. Watch the video again, and when it ends click your <b>Nine patch</b>, which will light up.',
      ),
    },
    done: () => design.blocks.every(b => b.pattern === 'nine' && blockKey(b) === blockKey(blk(4))),
  },
  {
    title: t('Add sashing'),
    // the copying is done: back to one block chosen, so the marks of the selection don't stay on the quilt
    enter: () => {
      setSelBlocks(new Set([4]));
      setFocusBlock(4);
      selParts.clear();
      renderDesigner();
    },
    clip: 'sash',
    back: () => openBlocks(ALL),
    text: t('Sashing is the strips between the blocks. Click the highlighted round button, <b>Sashing</b>.'),
    allow: ['#rail-sash'],
    glow: '#rail-sash',
    done: () => !$('dz-side').hidden && toolsPanel === 'sash',
  },
  {
    title: t('Try a narrow width'),
    back: () => showToolsPanel('sash'),
    text: t(
      'Click the highlighted width and watch the quilt: thin strips appear, with a small square where they meet, the cornerstone.',
    ),
    ...sashStep(2),
  },
  {
    title: t('Choose the one for this quilt'),
    back: () => showToolsPanel('sash'),
    text: t(
      'Now click this wider one, the one for this quilt: the strips grow, and so does the whole quilt. You can try any width on your own quilts.',
    ),
    ...sashStep(4),
  },
  {
    title: t('Open the borders'),
    clip: 'border',
    back: () => showToolsPanel('sash'),
    text: t('A border finishes the edge. Click the highlighted round button, <b>Borders</b>.'),
    allow: ['#rail-brd'],
    glow: '#rail-brd',
    done: () => !$('dz-side').hidden && toolsPanel === 'brd',
  },
  {
    title: t('Add a border'),
    back: () => showToolsPanel('brd'),
    text: t('In the <b>Borders</b> card, click <b>Plain strip</b> to frame your quilt.'),
    allow: ['#brd-types'],
    glow: '.brd-type[data-t="plain"]',
    done: () => bordersOf(design).length > 0 && bordersOf(design)[0].type === 'plain',
    // another kind of border: taken off again, since the steps that follow are about a plain strip
    check: () => bordersOf(design).length > 0 && bordersOf(design)[0].type !== 'plain',
    fix: () => dispatch(removeBorder, 0),
    says: t('That is another kind of border. Click <b>Plain strip</b>, please: the next steps are about it.'),
  },
  {
    title: t('Make the border narrower'),
    back: () => showToolsPanel('brd'),
    text: TOUCH
      ? t(
          'The border came 4 inches wide. In the <b>Borders</b> card, in the box with the <b>4</b>, type <b>3</b> and tap <b>OK</b> on the keyboard: the frame gets thinner, and the quilt a little smaller.',
        )
      : t(
          'The border came 4 inches wide. In the <b>Borders</b> card, in the box with the <b>4</b>, type <b>3</b> and press <b>Enter</b>: the frame gets thinner, and the quilt a little smaller.',
        ),
    allow: ['#brd-list'],
    glow: '#brd-list .brd-row:first-child .inch-whole, #brd-list .brd-row:first-child input[data-a="mm"]',
    done: () => Math.abs((bordersOf(design)[0]?.mm || 0) - 76) <= 1,
    // the cutting guide that follows is about this width
    check: () => {
      const mm = bordersOf(design)[0]?.mm;
      return mm != null && Math.abs(mm - 102) > 1 && Math.abs(mm - 76) > 1;
    },
    fix: () => dispatch(updateBorder, 0, { mm: 102 }),
    says: t('Type <b>3</b>, please, so that the quilt comes out like the one in the tutorial.'),
  },
  {
    title: t('Choose the border fabric'),
    back: () => showToolsPanel('brd'),
    enter: () => (tour.brdFab = bordersOf(design)[0]?.fabrics?.[0]),
    text: t(
      'Under the border, click <b>Fabric</b>: a list of fabrics opens. Click the one you like for the frame. The quilt changes at once; later you can change it as often as you like.',
    ),
    allow: ['#brd-list', '#brd-palbox'],
    glow: '#brd-list .brd-row:first-child .brd-slot[data-slot="0"]',
    done: () => !!tour.brdFab && bordersOf(design)[0]?.fabrics?.[0] !== tour.brdFab,
  },
  {
    title: t('Save your quilt'),
    text: t('A quilt is only kept once you save it. Click the highlighted round button, <b>Save</b>.'),
    allow: ['#dz-save'],
    glow: '#dz-save',
    done: () => $('save-dlg').open,
  },
  {
    title: t('Give it a name'),
    noBack: true,
    enter: () => {
      /** @type {HTMLInputElement} */ ($('save-name')).value = t('My first quilt');
    },
    text: t('You can keep this name or type another. Then click <b>Save</b>.'),
    allow: ['#save-name', '#save-ok'],
    glow: '#save-ok',
    done: () => !!mineCur,
  },
  {
    title: t('See it on a bed'),
    noBack: true,
    clip: 'bed',
    back: () => showToolsPanel('brd'),
    text: t(
      'Your quilt is saved: it is in <b>My designs</b>. Now see it on a bed. Click the highlighted round button, <b>On a bed</b>.',
    ),
    allow: ['#dz-sim', '#bedsel'],
    glow: '#dz-sim',
    // a 120 cm quilt on a single bed, where it covers the top: on a large bed it looks lost
    enter: () =>
      setTimeout(() => {
        const bed = /** @type {HTMLSelectElement} */ ($('bedsel'));
        bed.value = 'br-solteiro';
        bed.dispatchEvent(new Event('change', { bubbles: true }));
      }),
    done: () => state.page === 'sim',
  },
  {
    title: t('Look around'),
    back: () => showPage('sim'),
    enter: () => (tour.dragged = tour.zoomed = false),
    text: TOUCH
      ? t(
          'The quilt falls on the bed the way real fabric does. At this size it is a small cover: it covers only part of a single bed. <b>Slide your finger on the picture</b> to walk around the bed. To come closer, spread two fingers on it.',
        )
      : t(
          'The quilt falls on the bed the way real fabric does. At this size it is a small cover: it covers only part of a single bed. <b>Drag on the picture</b> with the mouse to walk around the bed, and turn the <b>mouse wheel</b> (on the touchpad of a laptop: slide two fingers up or down) to come closer.',
        ),
    allow: ['#view', '#stage'],
    glow: '#view',
    // on a touch screen, walking round is enough: spreading two fingers is shown, not asked for
    done: () => !!tour.dragged && (!!tour.zoomed || TOUCH),
  },
  {
    title: t('Try it on a table'),
    back: () => showPage('sim'),
    text: t(
      'A small quilt also makes a lovely table cover. In the list at the top, the one with the name of the bed, choose <b>Square table, 4 seats</b>: the quilt falls again, on the table.',
    ),
    allow: ['#bedsel'],
    glow: '#bedsel',
    done: () => /** @type {HTMLSelectElement} */ ($('bedsel')).value === 'tb-square4',
  },
  {
    title: t('Back to your quilt'),
    back: () => showPage('sim'),
    text: t('Click the <b>×</b> at the top left to go back to your quilt.'),
    allow: ['#sim-close'],
    glow: '#sim-close',
    done: () => state.page === 'design',
  },
  {
    title: t('See what to cut'),
    clip: 'cut',
    text: t(
      'Now open the <b>Cutting guide</b>: how much fabric to buy, and every piece to cut, already worked out. The fabric list also has the fabrics the sashing, the cornerstones and the border came with; you can change them in their own cards, under <b>Sashing</b> and <b>Borders</b>.',
    ),
    allow: ['#tabs [data-page="cut"]'],
    glow: '#tabs [data-page="cut"]',
    // inches mean a quarter-inch seam, as in the patterns a quilter knows
    enter: () => {
      if (getUnit() !== 'in') return;
      const seam = /** @type {HTMLSelectElement} */ ($('cg-seam'));
      tour.restoring = true;
      seam.value = '6.4';
      seam.dispatchEvent(new Event('change', { bubbles: true }));
      tour.restoring = false;
    },
    done: () => state.page === 'cut',
  },
  {
    title: t('Your shopping list'),
    back: () => showPage('cut'),
    text: t(
      'This table is your shopping list. Each fabric has a letter, and beside it how much to buy, with a little extra for straightening the cut. The <b>binding</b>, the strip that closes the edge of the quilt, is cut from the border fabric and is already counted. Click <b>Next</b> when you have read it.',
    ),
    allow: [],
    glow: '#cg-fabrics',
    buttons: [[t('Next'), 'on', true]],
  },
  {
    title: t('See the sizes'),
    back: () => showPage('cut'),
    text: t(
      'Click <b>Block 1</b>, the highlighted title: the list of pieces to cut opens below, with each size. Each piece has a code: <b>A1.1</b> means fabric A, block 1, shape 1 (the letters are the fabrics listed above). Scroll down the page to read it all.',
    ),
    allow: ['#cg-blocks .cgblock:first-child h3'],
    glow: '#cg-blocks .cgblock:first-child h3',
    done: () => !!document.querySelector('#cg-blocks .cgblock:first-child.open'),
  },
  {
    title: t('The border pieces'),
    back: () => showPage('cut'),
    // the code of this quilt's own border strip, read in its parts
    text: () => {
      const code = document.querySelector('#cg-blocks .cgblock:last-child td.l')?.textContent || 'AB1.1';
      return t(
        'The sashing and the border have their own cards further down. Click <b>Border 1</b>, the highlighted title: it lists the strips to cut for the border. A strip marked <b>{code}</b> is cut from fabric <b>{letter}</b> of the shopping list; <b>B1</b> means border 1, and the last number is the piece. Then click <b>Next</b>.',
        { code, letter: code[0] },
      );
    },
    allow: ['#cg-blocks .cgblock:last-child h3'],
    glow: '#cg-blocks .cgblock:last-child h3',
    // opened, it waits to be read: Next, rather than the page moving on to the PDF button at once
    buttons: [[t('Next'), 'on', true]],
  },
  {
    title: t('Take it to your sewing table'),
    back: () => showPage('cut'),
    text: t(
      'The <b>Download PDF (A4)</b> button saves all of this to print: the shopping list and every block with its pieces; shapes that a ruler cannot cut come with templates at real size. You can click it now, or later. Then click <b>Next</b>.',
    ),
    allow: ['#cg-pdf'],
    glow: '#cg-pdf',
    buttons: [[t('Next'), 'on', true]],
  },
  {
    title: t('The other round buttons'),
    back: () => showPage('cut'),
    keepOff: ['.rail'], // the buttons it talks about stay in sight
    enter: () => showPage('design'),
    // only the buttons this screen has (a phone has no Picture)
    text: () =>
      [
        t('Beside the quilt there are a few more, to try when you like:'),
        ...[
          ['#dz-undo', t('<b>Undo</b> takes back the last change.')],
          ['#dz-flip', t('<b>Turn over</b> shows the back of the quilt.')],
          ['#dz-picture', t('<b>Picture</b> makes a realistic photo of it.')],
          ['#dz-share', t('<b>Share</b> shows it to other quilters.')],
          ['#rail-sym', t('<b>Symmetry</b> repeats each change on the other side of the quilt, like a mirror.')],
          ['#tour-start', t('<b>Tutorial</b>, at the bottom left, starts this exercise again.')],
        ]
          .filter(([sel]) => {
            const el = /** @type {HTMLElement | null} */ (document.querySelector(sel));
            return !!el && !el.hidden && getComputedStyle(el).display !== 'none';
          })
          .map(([, line]) => `• ${line}`),
      ].join('<br>'),
    allow: [],
    glow: '#rail-sym',
    buttons: [[t('Next'), 'on', true]],
  },
  {
    title: t('Well done!'),
    text: t(
      'You made your first quilt, and it is saved.<br>• To find it again: <b>My designs</b>, at the top.<br>• To start another: <b>New</b>.<br>• To measure in millimetres: the <b>mm / in</b> switch.',
    ),
    center: true,
    buttons: [[t('Finish'), 'keep', true]],
  },
];
/** The quilt the tutorial starts from: a new quilt, one row of three, of 10 inches exactly, so that typing 12 makes 12. */
const tutorialQuilt = () => ({ ...newDesign(), blockMm: 254 });
function tourAllowed(el) {
  return !!(el && el.closest && (el.closest('#tour') || el.closest('.tour-allow')));
}
/** A warning on the card, shaken so that a second one is noticed too. @param {string} says */
function tourSay(says) {
  const note = $('tour-note');
  note.innerHTML = says;
  note.hidden = false;
  note.classList.remove('shake');
  void note.offsetWidth;
  note.classList.add('shake');
  requestAnimationFrame(tourPlace);
}
/** The wrong tile of a step that names one: say so, and show the step's video again. @param {any} st */
function tourWrong(st) {
  tourSay(st.pick.says);
  const right = document.querySelector(`${st.pick.tile}${st.pick.right}`);
  if (right) right.scrollIntoView({ block: 'nearest', inline: 'center' });
  tourReplay();
  requestAnimationFrame(tourPlace);
}
function tourBlock(e) {
  // only what the person does is held back: the app's own clicks (the PDF's download link) go through
  if (!tour.on || tour.restoring || !e.isTrusted) return;
  const st = TOUR[tour.i],
    el = e.target && e.target.closest ? e.target : null;
  // taking a fabric off the list has no place in the tutorial
  if (el && el.closest('.fab-x') && !el.closest('#tour')) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  const tile = st.pick && el && el.closest(st.pick.tile);
  if (tile && !tile.matches(st.pick.right)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'click') tourWrong(st);
    return;
  }
  if (tourAllowed(e.target)) return;
  // a control that is off for now: no silence, which would look as if the app had stopped working
  // (not for the click that ends the gesture which finished the step before: a finger lifted after a drag)
  if (
    e.type === 'click' &&
    st.glow &&
    el &&
    el.closest('button, input, select, label, canvas') &&
    tour.downAt >= tour.shownAt
  )
    tourSay(t('Only the highlighted item works on this step. Click it to go on.'));
  if (
    e.type === 'keydown' &&
    !['Enter', ' ', 'Escape'].includes(e.key) &&
    !((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key))
  )
    return; // reading and scrolling keys still work
  e.preventDefault();
  e.stopImmediatePropagation();
}
for (const ev of [
  'pointerdown',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'keydown',
  'change',
  'input',
  'contextmenu',
  'touchstart',
])
  document.addEventListener(ev, tourBlock, true);
for (const id of ['dz-dialog', 'save-dlg', 'cg-pop'])
  $(id).addEventListener('cancel', e => {
    if (tour.on && !(TOUR[tour.i].allow || []).includes('#dz-done')) e.preventDefault();
  });
function tourHost() {
  // the tour card must sit inside an open modal pop-up, or it would be blocked by it
  for (const id of ['save-dlg', 'cg-pop', 'dz-dialog']) {
    const d = $(id);
    if (d && d.open) return d;
  }
  return document.body;
}
// Place the card where it covers the least of what the user needs: the quilt, the open pop-up, the
// controls of this step, the toolbar and side panel. It can also be dragged by its top line, or folded.
function tourPlace() {
  tourArrow();
  const box = $('tour'),
    st = TOUR[tour.i],
    host = tourHost();
  if (box.parentElement !== host) host.appendChild(box);
  box.classList.toggle('center', !!st.center && !tour.userPos);
  const W = innerWidth,
    H = innerHeight,
    bw = box.offsetWidth,
    bh = box.offsetHeight,
    m = 12;
  const clampXY = (x, y) => [Math.max(m, Math.min(W - bw - m, x)), Math.max(m, Math.min(H - bh - m, y))];
  if (tour.userPos) {
    const [x, y] = clampXY(tour.userPos[0], tour.userPos[1]);
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    return;
  }
  if (st.center) {
    box.style.left = box.style.top = '';
    return;
  }
  const rectOf = el => {
    if (!el || el.hidden) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? r : null;
  };
  const tg = st.glow && document.querySelector(st.glow),
    T = rectOf(tg);
  const keep = []; // [rect, weight]
  // the card must not sit on what the step asks to click: with a video it is large, and nothing else matters as much
  // (a target as large as the quilt can't always be cleared, so it only counts like the rest)
  if (T) keep.push([T, T.width * T.height < 90000 ? 5000 : 12]);
  document.querySelectorAll('.tour-allow').forEach(el => {
    const r = rectOf(el);
    if (r) keep.push([r, 8]);
  });
  for (const sel of st.keepOff || [])
    document.querySelectorAll(sel).forEach(el => {
      const r = rectOf(el);
      if (r) keep.push([r, 40]);
    });
  // a cutting list just opened is being read: the card keeps off it too
  document.querySelectorAll('#cg-blocks .cgblock.open').forEach(el => {
    const r = rectOf(el);
    if (r) keep.push([r, 6]);
  });
  for (const sel of ['#dz-quilt', '#dz-size2', '#dz-size']) {
    const r = rectOf(document.querySelector(sel));
    if (r) keep.push([r, 3]);
  }
  if (host !== document.body) {
    const r = rectOf(host);
    if (r) keep.push([r, 6]);
  }
  const side = $('dz-side');
  if (side && !side.hidden) {
    const r = rectOf(side);
    if (r) keep.push([r, 5]);
  }
  const bar = $('tl-panel'),
    barTop = bar && !bar.hidden ? bar.getBoundingClientRect().top : H;
  const cands = [
    [m, m + 60],
    [W - bw - m, m + 60],
    [m, barTop - bh - m],
    [W - bw - m, barTop - bh - m],
    [m, (H - bh) / 2],
    [W - bw - m, (H - bh) / 2],
  ];
  if (T)
    cands.push(
      [T.right + 14, T.top + T.height / 2 - bh / 2],
      [T.left - 14 - bw, T.top + T.height / 2 - bh / 2],
      [T.left + T.width / 2 - bw / 2, T.bottom + 14],
      [T.left + T.width / 2 - bw / 2, T.top - 14 - bh],
    );
  // it stays where it is unless that gets in the way: a card that jumps has to be looked for at every step
  const stay = tour.pos ? [tour.pos.x, tour.pos.y] : null;
  if (stay) cands.push(stay);
  let best = null;
  for (const c of cands) {
    const [x, y] = clampXY(c[0], c[1]);
    let cost = 0;
    for (const [r, w] of keep) {
      const ox = Math.max(0, Math.min(x + bw, r.right) - Math.max(x, r.left)),
        oy = Math.max(0, Math.min(y + bh, r.bottom) - Math.max(y, r.top));
      cost += ox * oy * w;
    }
    if (y + bh > barTop) cost += (y + bh - barTop) * bw * 4; // keep the timeline strip clear
    if (T) cost += Math.hypot(x + bw / 2 - (T.left + T.width / 2), y + bh / 2 - (T.top + T.height / 2)) * 2; // then: as close to the target as possible
    if (c === stay) cost *= 0.2;
    if (!best || cost < best.cost) best = { x, y, cost };
  }
  tour.pos = { x: best.x, y: best.y };
  box.style.left = best.x + 'px';
  box.style.top = best.y + 'px';
}
function initTourDrag() {
  const head = document.querySelector('#tour .tour-head');
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const box = $('tour'),
      r = box.getBoundingClientRect(),
      dx = e.clientX - r.left,
      dy = e.clientY - r.top;
    box.classList.remove('center');
    head.setPointerCapture(e.pointerId);
    const move = ev => {
      tour.userPos = [ev.clientX - dx, ev.clientY - dy];
      tourPlace();
    };
    const up = () => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
  });
  $('tour-min').addEventListener('click', () => {
    const box = $('tour');
    box.classList.toggle('min');
    $('tour-min').textContent = box.classList.contains('min') ? '▢' : '–';
    $('tour-min').title = box.classList.contains('min') ? t('Show the instructions') : t('Fold the instructions');
    tourPlace();
  });
}
function tourMark() {
  document.querySelectorAll('.tour-allow').forEach(el => el.classList.remove('tour-allow'));
  document.querySelectorAll('.tour-glow').forEach(el => el.classList.remove('tour-glow'));
  document.querySelectorAll('.tour-target').forEach(el => el.classList.remove('tour-target'));
  // what the step asks for, by its selector: a row drawn again (core/dom.js sideRoller) keeps it in sight at once
  document.body.dataset.tourTarget = (tour.on && TOUR[tour.i].glow) || '';
  if (!tour.on) return;
  const st = TOUR[tour.i];
  for (const sel of st.allow || []) document.querySelectorAll(sel).forEach(el => el.classList.add('tour-allow'));
  // the video shows the step first; the sign lights up as it ends (the button works all along, for the impatient)
  // what the step asks to click, lit or not yet (while the video plays): in a row that scrolls sideways (drawn
  // again after each change) it is kept whole in sight from the start, so the row never moves under a click
  const target = st.glow && document.querySelector(st.glow);
  if (target) target.classList.add('tour-target');
  const g = !tour.watching && target;
  if (g) g.classList.add('tour-glow');
  if (target) {
    const row = /** @type {HTMLElement | null} */ (target.parentElement);
    if (row && row.scrollWidth > row.clientWidth + 1) {
      const r = target.getBoundingClientRect(),
        box = row.getBoundingClientRect();
      if (r.left < box.left - 1 || r.right > box.right + 1)
        row.scrollLeft += r.left - box.left - (box.width - r.width) / 2;
    }
  }
}
/** The step's short video, in the language in use: it plays once. With none (or none that loads), straight to the sign. */
function tourClip(st) {
  const v = /** @type {HTMLVideoElement} */ ($('tour-clip')),
    box = $('tour');
  const stop = () => {
    tour.watching = false;
    tourMark();
  };
  // once it has played, the video shrinks to its last picture, so the card covers less of the page
  v.onended = () => {
    stop();
    box.classList.add('clip-small');
    requestAnimationFrame(tourPlace);
  };
  box.classList.remove('clip-small');
  v.onerror = () => {
    v.hidden = $('tour-replay').hidden = true;
    box.classList.remove('with-clip');
    stop();
    tourPlace();
  };
  v.pause();
  // the videos show a computer's screen: on a phone they are too small to help, and the card covers less without
  if (!st.clip || innerWidth < 640) {
    v.removeAttribute('src');
    v.hidden = $('tour-replay').hidden = true;
    box.classList.remove('with-clip');
    tour.watching = false;
    return;
  }
  v.hidden = $('tour-replay').hidden = false;
  box.classList.add('with-clip');
  v.src = `assets/clips/tut_${getLang() === 'en' ? 'en' : 'pt'}_${st.clip}.mp4`;
  // with less motion asked for, it waits for "Watch again"
  tour.watching = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (tour.watching) v.play().catch(stop);
}
/** The step's video from the start: the sign waits for it again. */
function tourReplay() {
  const v = /** @type {HTMLVideoElement} */ ($('tour-clip'));
  if (v.hidden || !v.getAttribute('src')) return;
  tour.watching = true;
  tourMark();
  $('tour').classList.remove('clip-small');
  requestAnimationFrame(tourPlace);
  // from the start by loading it again: jumping back fails on a server that can't send part of a file
  v.load();
  v.play().catch(() => {
    tour.watching = false;
    tourMark();
  });
}
/** The arrow beside a row that scrolls, pointing along it. */
function tourArrow() {
  const a = $('tour-arrow'),
    row = tour.on && TOUR[tour.i].arrow && document.querySelector(TOUR[tour.i].arrow);
  a.hidden = !row;
  a.row = row;
  if (!row) return;
  const r = row.getBoundingClientRect();
  a.style.left = `${r.right - 50}px`;
  a.style.top = `${r.top - 50}px`;
}
function tourShow() {
  const st = TOUR[tour.i];
  tour.shownAt = performance.now();
  $('tour-note').hidden = true;
  $('tour-count').textContent = st.center
    ? t('Guided tour')
    : t('Step {n} of {all}', { n: tour.i, all: TOUR.length - 2 });
  $('tour-title').textContent = st.title;
  $('tour-text').innerHTML = typeof st.text === 'function' ? st.text() : st.text;
  $('tour-prog').style.width = `${Math.round((tour.i / (TOUR.length - 1)) * 100)}%`;
  const acts = $('tour-actions');
  acts.innerHTML = '';
  for (const [label, act, primary] of st.buttons || []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (primary) b.className = 'primary';
    b.addEventListener('click', () => tourAct(act));
    acts.appendChild(b);
  }
  $('tour-skip').hidden = tour.i === TOUR.length - 1;
  $('tour-back').hidden = tour.i < 2 || !!st.noBack; // (a saved quilt stays saved: no undoing that step)
  if (design) tour.steps[tour.i] = JSON.stringify(design); // the quilt as this step found it, to come back to
  tourClip(st);
  if (st.enter) st.enter();
  tour.mark = st.start ? st.start() : null;
  tourMark();
  const g = st.glow && document.querySelector(st.glow);
  if (g) g.scrollIntoView({ block: 'center', inline: 'nearest' });
  // once a panel has finished opening, the thing to click is whole in its row (not cut off at the edge)
  if (g) setTimeout(() => g.isConnected && g.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 450);
  requestAnimationFrame(tourPlace);
  if (st.buttons) acts.querySelector('button').focus();
}
/** One step back: the quilt as that step found it, with its page and panel, so it can be done again. */
function tourBack() {
  if (tour.i < 2) return;
  tour.i--;
  tour.restoring = true; // (undoing a step goes through controls the step before has switched off)
  showPage('design');
  replaceDesign(JSON.parse(tour.steps[tour.i]), { timeline: 'tour' });
  const st = TOUR[tour.i];
  if (st.back) st.back();
  tour.restoring = false;
  tourShow();
}
function tourTick() {
  if (!tour.on) return;
  const st = TOUR[tour.i];
  // done, but not as the step asks: put it right where that makes sense, say so, and show the video again
  if (st.check && st.check()) {
    if (st.fix) st.fix();
    const says = typeof st.says === 'function' ? st.says() : st.says;
    if ($('tour-note').innerHTML !== says || $('tour-note').hidden) {
      tourSay(says);
      if (st.clip) tourReplay();
    }
  }
  tourMark();
  tourPlace();
  if (st.done && st.done(tour.mark || {})) {
    tour.i++;
    tourShow();
  }
}
function tourBegin() {
  if (tour.on) return;
  tour.saved = design ? JSON.stringify(design) : null;
  tour.unit = getUnit();
  tour.savedCur = typeof mineCur !== 'undefined' ? mineCur : null;
  tour.bed = /** @type {HTMLSelectElement} */ ($('bedsel')).value;
  tour.on = true;
  tour.i = 0;
  tour.userPos = null;
  tour.pos = null;
  document.body.classList.add('tour-active');
  for (const id of ['dz-dialog', 'save-dlg', 'cg-pop']) if ($(id).open) $(id).close();
  if (state.page !== 'design') showPage('design');
  hideTools();
  // the tutorial always starts from the same quilt, with its own timeline; the user's own quilt is put aside and
  // comes back if they skip or ask for it at the end
  const fresh = () => {
    timelines.remove(tlKeyFor('tour'));
    setMineCur(null); // saving it must make a new design, not overwrite the one that was open
    replaceDesign(tutorialQuilt(), { timeline: 'tour' });
  };
  if (design) fresh();
  else
    (async () => {
      await initFabricLib();
      ensureDesign();
      fresh();
    })();
  $('tour').hidden = false;
  tourShow();
  clearInterval(tour.poll);
  tour.poll = setInterval(tourTick, 200);
}
function tourAct(act) {
  if (act === 'on') {
    // a step that is only read: on to the next one
    tour.i++;
    tourShow();
    return;
  }
  if (act === 'next') {
    tour.i = 1;
    tourShow();
    return;
  }
  if (act === 'skip') {
    tourEnd('restore');
    return;
  }
  tourEnd(act);
}
/** Skipping or going back to the quilt from before: the unit from before too (keeping the quilt keeps the inches). */
function setUnitBack() {
  if (getUnit() === tour.unit) return;
  const sw = /** @type {HTMLInputElement} */ ($('unit-sw'));
  sw.checked = tour.unit === 'in';
  sw.dispatchEvent(new Event('change', { bubbles: true }));
}
function tourEnd(how) {
  tour.on = false;
  tour.watching = false;
  /** @type {HTMLVideoElement} */ ($('tour-clip')).pause();
  clearInterval(tour.poll);
  document.body.classList.remove('tour-active');
  tourMark();
  tourArrow();
  const box = $('tour');
  box.hidden = true;
  document.body.appendChild(box);
  try {
    localStorage.setItem(TOUR_KEY, 'done');
  } catch (e) {}
  for (const id of ['dz-dialog']) if ($(id).open) $(id).close();
  if (how === 'keep') {
    // the quilt was saved along the way: it stays open, with no selection left on it
    setSelBlocks(new Set([0]));
    setFocusBlock(0);
    selParts.clear();
    hideTools();
    renderDesigner();
  } else if (how === 'restore') setUnitBack();
  if (how === 'restore' && tour.saved) {
    setMineCur(tour.savedCur);
    mineSave();
    openDesign(tour.saved, { timeline: mineCur, quiet: true });
  }
  // the bed or table chosen before: "On a bed" must not open on the tutorial's table afterwards
  const bed = /** @type {HTMLSelectElement} */ ($('bedsel'));
  if (tour.bed && bed.value !== tour.bed) {
    bed.value = tour.bed;
    bed.dispatchEvent(new Event('change', { bubbles: true }));
  }
  timelines.remove(tlKeyFor('tour'));
  if (how !== 'keep') showPage('design');
}
$('tour-start').addEventListener('click', () => confirmLeave(tourBegin));
// the "look around" step: a drag or a turn of the wheel on the 3D view
for (const ev of ['pointermove', 'wheel'])
  $('view').addEventListener(ev, e => {
    if (ev === 'wheel') tour.zoomed = true;
    else if (/** @type {PointerEvent} */ (e).buttons) tour.dragged = true;
  });
initTourDrag();
$('tour-skip').addEventListener('click', () => tourAct('skip'));
$('tour-back').addEventListener('click', tourBack);
// the small video, after it has played: a click plays it again, large
$('tour-clip').addEventListener('click', tourReplay);
// is the mouse held down? (a selection dragged half way is not a mistake yet)
// (on the window, so it runs before the tour's own blocking of pointerdown on the page)
window.addEventListener(
  'pointerdown',
  () => {
    tour.down = true;
    tour.downAt = performance.now();
  },
  true,
);
document.addEventListener('pointerup', () => (tour.down = false), true);
$('tour-arrow').addEventListener('click', () => {
  const row = /** @type {any} */ ($('tour-arrow')).row;
  if (!row) return;
  const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
  row.scrollTo({ left: atEnd ? 0 : row.scrollLeft + 260, behavior: 'smooth' });
});
$('tour-replay').addEventListener('click', tourReplay);
window.addEventListener('resize', () => {
  if (tour.on) tourPlace();
});
document.addEventListener(
  'scroll',
  () => {
    if (tour.on) tourPlace();
  },
  true,
);
// first visit: offer the tour once the designer is ready, and once the welcome page (mine/account.js) is closed
function offerTour() {
  if ($('welcome') && !$('welcome').hidden) return setTimeout(offerTour, 700);
  let seen = null;
  try {
    seen = localStorage.getItem(TOUR_KEY);
  } catch (e) {}
  if (!seen && !IS_PHONE && state.page === 'design') tourBegin();
}
setTimeout(offerTour, 1200);
