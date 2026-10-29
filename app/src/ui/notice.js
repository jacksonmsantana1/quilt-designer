// A short message at the bottom of the page (no side effects when loaded: the element is made on first use).
let box = null,
  timer = 0;
/**
 * Shows a message for a few seconds (longer for longer messages). Click it to close it.
 * @param {string} text @param {{ ms?: number }} [opts]
 */
function notify(text, opts = {}) {
  if (typeof document === 'undefined') return;
  if (!box) {
    box = document.createElement('div');
    box.id = 'notice';
    box.setAttribute('role', 'status');
    box.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;max-width:min(560px,calc(100vw - 32px));' +
      'background:#2f466f;color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);' +
      'font:14px/1.45 system-ui,sans-serif;cursor:pointer;white-space:pre-line';
    box.addEventListener('click', () => (box.hidden = true));
    document.body.appendChild(box);
  }
  box.textContent = text;
  box.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (box.hidden = true), opts.ms || Math.max(5000, text.length * 60));
}

export { notify };
