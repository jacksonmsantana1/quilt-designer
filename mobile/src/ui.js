// Small building blocks of the phone's screens: making elements, sheets that slide up, questions and short messages.
import { t } from '@quilt/shared/i18n.js';

const $ = /** @type {(id: string) => any} */ (id => document.getElementById(id));

/** Without what's left out by a condition (`a && b`): append() would write "false" or "null" on the screen. */
const shown = kids => kids.filter(x => x !== null && x !== undefined && x !== false && x !== '');

/**
 * An element: class, on<event> handlers, properties and attributes from `props`, then its children.
 * @param {string} tag @param {Record<string, any>} [props] @param {...any} kids @returns {any}
 */
function el(tag, props = {}, ...kids) {
  const e = /** @type {any} */ (document.createElement(tag));
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  e.append(...shown(kids));
  return e;
}

/**
 * A sheet over the screen (the whole screen with full), closed by its × or by tapping beside it.
 * @param {string} title @param {{ full?: boolean }} [o] @returns {{ dialog: any, body: any, close: () => void }}
 */
function openSheet(title, { full = false } = {}) {
  const body = el('div', { class: 'sheet-body' });
  const dialog = el(
    'dialog',
    { class: full ? 'sheet full' : 'sheet' },
    el(
      'header',
      { class: 'sheet-top' },
      el('h2', { textContent: title }),
      el('button', {
        type: 'button',
        class: 'close',
        'aria-label': t('Close'),
        textContent: '×',
        onclick: () => dialog.close(),
      }),
    ),
    body,
  );
  dialog.addEventListener('click', e => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, body, close: () => dialog.close() };
}

/**
 * A question with one button that goes ahead. @param {string} title @param {string} message @param {string} yes
 * @param {{ danger?: boolean }} [o] @returns {Promise<boolean>} false when it is closed instead
 */
function ask(title, message, yes, { danger = false } = {}) {
  return new Promise(done => {
    const s = openSheet(title);
    let answer = false;
    s.dialog.addEventListener('close', () => done(answer));
    s.body.append(
      el('p', { textContent: message }),
      el(
        'div',
        { class: 'row' },
        el('button', {
          type: 'button',
          class: 'btn ask-no',
          textContent: t('Cancel'),
          onclick: () => s.close(),
        }),
        el('button', {
          type: 'button',
          class: danger ? 'btn danger ask-yes' : 'btn solid ask-yes',
          textContent: yes,
          onclick: () => {
            answer = true;
            s.close();
          },
        }),
      ),
    );
  });
}

/** A short message for a few seconds, over whatever is open. @param {string} text */
function say(text) {
  const open = document.querySelectorAll('dialog[open]'),
    m = el('div', { class: 'toast', role: 'status', textContent: text });
  (open[open.length - 1] || document.body).append(m);
  setTimeout(() => m.remove(), 4000);
}

/**
 * A press on something: a tap, or holding it down. Holding is also the right click of a computer, and the long press
 * Android reports by itself. @param {any} node @param {() => void} tap @param {() => void} hold
 */
function pressable(node, tap, hold) {
  let timer = /** @type {any} */ (0),
    held = false,
    x = 0,
    y = 0;
  const stop = () => clearTimeout(timer);
  node.addEventListener('pointerdown', e => {
    held = false;
    x = e.clientX;
    y = e.clientY;
    stop();
    timer = setTimeout(() => {
      held = true;
      hold();
    }, 450);
  });
  node.addEventListener('pointermove', e => {
    if (Math.hypot(e.clientX - x, e.clientY - y) > 10) stop(); // scrolling, not holding
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) node.addEventListener(ev, stop);
  node.addEventListener('contextmenu', e => {
    e.preventDefault();
    stop();
    if (!held) hold();
    held = true;
  });
  node.addEventListener('click', e => {
    if (held) e.preventDefault();
    else tap();
    held = false;
  });
}

export { $, ask, el, openSheet, pressable, say, shown };
