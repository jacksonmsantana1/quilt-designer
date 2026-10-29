// Pattern dropdown with a sketch of every block.
import '../sim/panels.js'; // load order: runs after sim/panels
import { design, focusBlock } from '../core/store.js';
import { $ } from '../core/dom.js';
import { PATTERNS, partsOf } from '../core/patterns.js';
import { pathPoly } from '../core/geometry.js';

// ---- block pattern picker: a dropdown that shows a sketch of every pattern
function patternSketch(key, px = 34) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2),
    c = document.createElement('canvas');
  c.width = c.height = Math.round(px * 1.5 * dpr); // drawn larger: it grows when hovered
  const g = c.getContext('2d'),
    S = c.width,
    cols = ['#efe5cf', '#2f466f', '#c79a45'];
  partsOf(key).forEach(part => {
    g.fillStyle = cols[part.role];
    pathPoly(
      g,
      part.poly.map(([u, v]) => [u * S, v * S]),
    );
    g.fill();
    g.lineWidth = Math.max(1, S / 120);
    g.strokeStyle = 'rgba(0,0,0,.28)';
    g.stroke();
  });
  return c;
}
function updatePatPicker() {
  const btn = $('dz-patbtn');
  if (!btn || !design) return;
  const key = design.blocks[focusBlock].pattern;
  if (btn.dataset.key !== key) {
    btn.dataset.key = key;
    btn.innerHTML = '';
    const sp = document.createElement('span');
    sp.textContent = PATTERNS[key].label;
    btn.append(patternSketch(key), sp);
  }
  for (const o of $('dz-patlist').children) o.setAttribute('aria-selected', String(o.dataset.key === key));
}
function initPatPicker() {
  const btn = $('dz-patbtn'),
    list = $('dz-patlist');
  for (const [key, p] of Object.entries(PATTERNS)) {
    const o = document.createElement('button');
    o.type = 'button';
    o.className = 'patopt';
    o.role = 'option';
    o.dataset.key = key;
    o.tabIndex = -1;
    const sp = document.createElement('span');
    sp.textContent = p.label;
    o.append(patternSketch(key), sp);
    list.appendChild(o);
  }
  const opts = () => [...list.children];
  const open = () => {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const cur = opts().find(o => o.getAttribute('aria-selected') === 'true') || opts()[0];
    cur.scrollIntoView({ block: 'nearest' });
    cur.focus({ preventScroll: true });
  };
  const close = refocus => {
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (refocus) btn.focus();
  };
  const choose = key => {
    const ps = $('dz-patsel');
    ps.value = key;
    ps.dispatchEvent(new Event('change'));
    close(true);
  };
  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  list.addEventListener('click', e => {
    const o = e.target.closest('.patopt');
    if (o) choose(o.dataset.key);
  });
  list.addEventListener('keydown', e => {
    const all = opts(),
      i = all.indexOf(document.activeElement);
    const cols = Math.max(1, Math.round(list.clientWidth / (all[0].offsetWidth || 150)));
    const go = j => {
      const o = all[Math.max(0, Math.min(all.length - 1, j))];
      o.focus();
      o.scrollIntoView({ block: 'nearest' });
    };
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      go(i + cols);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      go(i - cols);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(i + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(i - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') close(false);
  });
  btn.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && list.hidden) {
      e.preventDefault();
      open();
    }
  });
  document.addEventListener('pointerdown', e => {
    if (!list.hidden && !$('dz-patpick').contains(e.target)) close(false);
  });
  // Escape inside the list closes only the list, not the whole pop-up
  $('dz-dialog').addEventListener('cancel', e => {
    if (!list.hidden) {
      e.preventDefault();
      close(true);
    }
  });
}
initPatPicker();

export { updatePatPicker };
