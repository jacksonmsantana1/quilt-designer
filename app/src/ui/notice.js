// A short message at the bottom of the page (no side effects when loaded: the element is made on first use).
let box = null,
  timer = 0;
/**
 * Shows a message for a few seconds (longer for longer messages). Click it to close it. With an action, a
 * button follows the text ("Undo") that runs it and closes the message.
 * @param {string} text @param {{ ms?: number, action?: { label: string, run: () => void } }} [opts]
 */
function notify(text, opts = {}) {
  if (typeof document === 'undefined') return;
  if (!box) {
    box = document.createElement('div');
    box.id = 'notice';
    box.setAttribute('role', 'status');
    box.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;max-width:min(560px,calc(100vw - 32px));' +
      // dark brown with cream text, like the messages on the first page (the colours follow the page's theme)
      'background:var(--ink,#2e211c);color:var(--bg,#faf3e8);padding:12px 16px;border-radius:10px;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.22);font:15px/1.45 var(--font-body,system-ui),sans-serif;cursor:pointer;white-space:pre-line';
    box.addEventListener('click', () => (box.hidden = true));
    document.body.appendChild(box);
  }
  box.textContent = text;
  if (opts.action) {
    const { label, run } = opts.action,
      b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'margin-left:12px;background:none;border:2px dashed currentColor;color:inherit;border-radius:6px;' +
      'padding:2px 10px;font:700 13px var(--font-body,system-ui),sans-serif;cursor:pointer';
    b.addEventListener('click', e => {
      e.stopPropagation();
      box.hidden = true;
      run();
    });
    box.appendChild(b);
  }
  box.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (box.hidden = true), opts.ms || Math.max(5000, text.length * 60));
}

export { notify };
