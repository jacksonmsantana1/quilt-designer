// Making and saving the PDF.
import './templates.js'; // load order: runs after pdf/templates
import { design } from '../core/store.js';
import { lastPlan } from '../render/hi-state.js';
import { $ } from '../core/dom.js';
import { bordersOf } from '../core/geometry.js';
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
} from './pages.js';
import { templateJobs } from './templates.js';

async function makeCutPdf() {
  if (!design) return null;
  if (!lastPlan) renderCut();
  const P = lastPlan,
    jobs = [];
  jobs.push(
    n => pdfFabricPage(P, n),
    (n, p) => pdfQuiltPage(P, p, n),
  );
  P.blocks.forEach((b, i) => {
    jobs.push((n, p) => pdfBlockPage(P, b, i, p, n));
    jobs.push(...templateJobs(P, b, i));
  });
  if ((P.sashing || []).some(x => x.group === 'sash')) jobs.push((n, p) => pdfSashPage(P, p, n));
  bordersOf(design).forEach((_, bi) => {
    if ((P.sashing || []).some(x => x.group === 'b' + bi)) jobs.push((n, p) => pdfBorderPage(P, bi, p, n));
  });
  const total = jobs.length,
    pages = [];
  for (let k = 0; k < total; k++) {
    cgPdfStatus(`Drawing page ${k + 1} of ${total}…`);
    await new Promise(r => setTimeout(r, 0));
    const c = jobs[k](total, k + 1);
    pages.push({ w: c.width, h: c.height, jpg: await canvasJpeg(c) });
  }
  return buildPdf(pages);
}
function cgPdfStatus(t) {
  const el = $('cg-pdfstat');
  el.textContent = t;
  el.hidden = !t;
  clearTimeout(cgPdfStatus.t);
  if (t && !t.endsWith('…')) cgPdfStatus.t = setTimeout(() => cgPdfStatus(''), 5000);
}
async function downloadCutPdf() {
  const btn = $('cg-pdf');
  btn.disabled = true;
  const d = new Date(),
    pad = n => String(n).padStart(2, '0');
  const filename = `quilt-cutting-guide-A4-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.pdf`;
  try {
    const blob = await makeCutPdf();
    window.__lastCutPdf = blob;
    if (downloads) {
      cgPdfStatus('Saving…');
      const res = await downloads.save({ filename, data: blob });
      cgPdfStatus(res && res.status === 'delivered' ? 'Sent' : 'Saved');
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      cgPdfStatus('Saved');
    }
  } catch (e) {
    const code = e && e.code;
    cgPdfStatus(
      code === 'declined'
        ? 'Not saved'
        : code === 'rate_limited'
          ? 'A save dialog is already open'
          : (e && e.message) || 'The PDF could not be made',
    );
  } finally {
    btn.disabled = false;
  }
}
$('cg-pdf').addEventListener('click', downloadCutPdf);
