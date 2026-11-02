// Puts the page's fixed text into the chosen language, and runs the language menus. The first thing that runs (see
// storage/boot.js), so every other module finds the page already translated. template.html stays in English: its
// text and tooltips are looked up in the dictionary here, one piece at a time.
import { getLang, saveLang, t } from '@quilt/shared/i18n.js';
import { flush } from '../storage/repo.js';

const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE']);

/** The text with the same spaces around it, translated. Spaces inside are the template's line wrapping. @param {string} s */
function translated(s) {
  const key = s.replace(/\s+/g, ' ').trim();
  if (!key) return s;
  const out = t(key);
  return out === key ? s : s.replace(/^(\s*)[\s\S]*?(\s*)$/, (_, a, b) => a + out + b);
}

/** @param {Element} root */
function translateTree(root) {
  if (SKIP.has(root.tagName)) return;
  for (const a of ATTRIBUTES) if (root.hasAttribute(a)) root.setAttribute(a, translated(root.getAttribute(a) || ''));
  if (root instanceof HTMLTemplateElement) for (const el of root.content.children) translateTree(el);
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) node.nodeValue = translated(node.nodeValue || '');
    else if (node.nodeType === Node.ELEMENT_NODE) translateTree(/** @type {Element} */ (node));
  }
}

document.documentElement.lang = getLang();
if (getLang() !== 'en') translateTree(document.documentElement);

for (const menu of document.querySelectorAll('select[data-lang]')) {
  const sel = /** @type {HTMLSelectElement} */ (menu);
  sel.value = getLang();
  sel.addEventListener('change', async () => {
    saveLang(sel.value === 'pt-BR' ? 'pt-BR' : 'en');
    await flush(); // the quilt being edited is written before the page goes away
    location.reload();
  });
}
