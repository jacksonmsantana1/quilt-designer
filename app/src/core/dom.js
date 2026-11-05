// DOM helpers shared by every module.
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

/**
 * A list that is one row scrolling sideways (fabrics, blocks in the quilt): the mouse wheel scrolls it too (set up
 * once per list), but only while there is more to see that way, so the page still scrolls at either end; and the
 * chosen item is brought into the middle (the lists are drawn again after every change, back at their start).
 * @param {HTMLElement} box @param {string} chosen selector of the chosen item
 */
function sideRoller(box, chosen) {
  if (!box.dataset.roller) {
    box.dataset.roller = '1';
    box.addEventListener(
      'wheel',
      e => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || box.scrollWidth <= box.clientWidth) return;
        const max = box.scrollWidth - box.clientWidth;
        if ((e.deltaY < 0 && box.scrollLeft <= 0) || (e.deltaY > 0 && box.scrollLeft >= max - 1)) return;
        e.preventDefault();
        box.scrollLeft += e.deltaY;
      },
      { passive: false },
    );
    box.addEventListener('scroll', () => (box.dataset.left = String(box.scrollLeft)));
  }
  // the guided tour's highlighted tile comes first: it is the one to click now
  const on = /** @type {HTMLElement | null} */ (box.querySelector('.tour-glow') || box.querySelector(chosen));
  if (!on || !box.clientWidth) return;
  // where the row was before it was drawn again: it stays there while the chosen item is in sight, so a pick
  // doesn't slide the tiles from under the mouse
  const left = Number(box.dataset.left || 0),
    x = on.offsetLeft;
  if (x >= left && x + on.offsetWidth <= left + box.clientWidth) box.scrollLeft = left;
  else box.scrollLeft = Math.max(0, on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2);
}

/**
 * A colour of the page's theme (a --custom property such as --mark), for what is drawn on canvases, so it follows
 * the page's colours and dark mode; the fallback outside a page (Node) or when the property is missing.
 * @param {string} name @param {string} fallback
 */
function themeColour(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export { $, esc, sideRoller, themeColour };
