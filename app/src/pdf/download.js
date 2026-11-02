// Making and saving the PDF.
import './templates.js'; // load order: runs after pdf/templates
import { design } from '../core/store.js';
import { lastPlan } from '../render/hi-state.js';
import { $ } from '../core/dom.js';
import { bordersOf } from '@quilt/shared/geometry.js';
import { renderCut } from '../cutting/page.js';
import { downloads } from '../platform/downloads.js';
import {
  buildPdf,
  canvasJpeg,
  pdfBlockPage,
  pdfBorderPage,
  pdfFabricPage,
  pdfQuiltPage,
  pdfSashPage,
  pdfSettingPage,
} from './pages.js';
import { templateJobs } from './templates.js';
import { isFabric, loadFabrics } from '../designer/fabric-library.js';
import { fabricIdsIn } from '../core/fabric-picks.js';
import { t } from '@quilt/shared/i18n.js';

async function makeCutPdf() {
  if (!design) return null;
  await loadFabrics(fabricIdsIn(design, isFabric)); // the real pictures, never the stand-in of one still loading
  if (!lastPlan) renderCut();
  const P = lastPlan,
    jobs = [];
  jobs.push(n => pdfFabricPage(P, n));
  // (a mosaic's card is the whole quilt already, its pieces labelled)
  if (!design.mosaic) jobs.push((n, p) => pdfQuiltPage(P, p, n));
  P.blocks.forEach((b, i) => {
    jobs.push((n, p) => pdfBlockPage(P, b, i, p, n));
    jobs.push(...templateJobs(P, b, i));
  });
  if ((P.sashing || []).some(x => x.group === 'sash')) jobs.push((n, p) => pdfSashPage(P, p, n));
  if ((P.sashing || []).some(x => x.group === 'setting')) jobs.push((n, p) => pdfSettingPage(P, p, n));
  bordersOf(design).forEach((_, bi) => {
    if ((P.sashing || []).some(x => x.group === 'b' + bi)) jobs.push((n, p) => pdfBorderPage(P, bi, p, n));
  });
  const total = jobs.length,
    pages = [];
  for (let k = 0; k < total; k++) {
    cgPdfStatus(t('Drawing page {k} of {total}…', { k: k + 1, total }));
    await new Promise(r => setTimeout(r, 0));
    const c = jobs[k](total, k + 1);
    pages.push({ w: c.width, h: c.height, jpg: await canvasJpeg(c) });
  }
  return buildPdf(pages);
}
// (a message still under way ends in "…" in every language and stays until the next one)
function cgPdfStatus(msg) {
  const el = $('cg-pdfstat');
  el.textContent = msg;
  el.hidden = !msg;
  clearTimeout(cgPdfStatus.t);
  if (msg && !msg.endsWith('…')) cgPdfStatus.t = setTimeout(() => cgPdfStatus(''), 5000);
}
async function downloadCutPdf() {
  const btn = $('cg-pdf');
  btn.disabled = true;
  const d = new Date(),
    pad = n => String(n).padStart(2, '0');
  const filename = t('quilt-cutting-guide-A4-{date}.pdf', {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  });
  try {
    const blob = await makeCutPdf();
    window.__lastCutPdf = blob;
    if (downloads) {
      cgPdfStatus(t('Saving…'));
      const res = await downloads.save({ filename, data: blob });
      cgPdfStatus(res && res.status === 'delivered' ? t('Sent') : t('Saved'));
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      cgPdfStatus(t('Saved'));
    }
  } catch (e) {
    const code = e && e.code;
    cgPdfStatus(
      code === 'declined'
        ? t('Not saved')
        : code === 'rate_limited'
          ? t('A save dialog is already open')
          : (e && e.message) || t('The PDF could not be made'),
    );
  } finally {
    btn.disabled = false;
  }
}
$('cg-pdf').addEventListener('click', downloadCutPdf);
