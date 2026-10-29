// New fabric from the webcam.
import '../app/layout.js'; // load order: runs after app/layout
import { camTarget, setCamTarget } from '../designer/ui-state.js';
import { selParts, setActiveFabric } from '../core/store.js';
import { $ } from '../core/dom.js';
import { loadImage } from '../sim/textures.js';
import { fabricLib } from '../designer/fabric-library.js';
import { drawFabricPalette } from '../designer/parts-editor.js';
import { applyFabric } from '../designer/edits.js';

// ---- new fabric from the camera
// Live camera where the viewer allows it (getUserMedia); otherwise the phone's own camera or a
// file through a capture input. The square inside the guide becomes the fabric: its lighting is
// evened out (divided by a heavily blurred copy) and its edges cross-faded with a half-offset copy
// so it repeats without visible seams.
const cam = { stream: null, facing: 'environment', devices: 0, shot: null };
function camMsg(t) {
  $('cam-msg').textContent = t || '';
}
function camStop() {
  if (cam.stream) {
    for (const tr of cam.stream.getTracks()) tr.stop();
    cam.stream = null;
  }
  $('cam-video').srcObject = null;
}
// Is the camera allowed in this frame at all? (an embedding page can block it outright)
function camPolicyAllows() {
  const pp = document.permissionsPolicy || document.featurePolicy;
  try {
    return pp && pp.allowsFeature ? pp.allowsFeature('camera') : true;
  } catch (e) {
    return true;
  }
}
async function camPermissionState() {
  try {
    return (await navigator.permissions.query({ name: 'camera' })).state;
  } catch (e) {
    return 'unknown';
  }
}
// Step 1: ask the viewer before the browser's own prompt appears
async function camAsk() {
  camStop();
  cam.shot = null;
  $('cam-ask').hidden = false;
  $('cam-viewbox').hidden = true;
  $('cam-live-row').hidden = true;
  $('cam-review').hidden = true;
  camMsg('');
  const note = $('cam-ask-note'),
    allow = $('cam-allow'),
    tab = $('cam-newtab');
  note.hidden = true;
  allow.hidden = false;
  allow.disabled = false;
  tab.hidden = true;
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    note.textContent =
      'This browser view does not offer a camera. Use a photo file (on a phone it opens the camera), or open the stand-alone copy of this site, quilt_designer.html, in Chrome, Edge or Firefox.';
    note.hidden = false;
    allow.hidden = true;
    return;
  }
  if (!camPolicyAllows()) {
    note.textContent =
      'Claude shows this page in a protected window that blocks webcams, so the browser cannot ask for permission here. Use a photo file (on a phone this opens the camera), or open the stand-alone copy of this site, quilt_designer.html, in Chrome, Edge or Firefox to use the webcam.';
    note.hidden = false;
    allow.hidden = true;
    return;
  }
  const st = await camPermissionState();
  if (st === 'granted') {
    camStart();
    return;
  } // already allowed: go straight to the camera
  if (st === 'denied') {
    note.textContent =
      'The camera is blocked for this page. Click the camera or lock icon in the address bar, set Camera to "Allow", then press "Allow webcam" again.';
    note.hidden = false;
  }
}
async function camStart() {
  camStop();
  cam.shot = null;
  $('cam-ask').hidden = true;
  $('cam-viewbox').hidden = false;
  $('cam-review').hidden = true;
  $('cam-live-row').hidden = false;
  $('cam-shot').hidden = true;
  $('cam-video').hidden = false;
  $('cam-guide').hidden = false;
  camMsg('Waiting for permission to use the webcam…');
  $('cam-snap').disabled = true;
  try {
    // this call is what makes the browser show its permission prompt
    cam.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: cam.facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    $('cam-video').srcObject = cam.stream;
    await $('cam-video')
      .play()
      .catch(() => {});
    camMsg('Fill the dashed square with the fabric, hold steady, then take the picture.');
    $('cam-snap').disabled = false;
    cam.hadLive = true;
    try {
      cam.devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput').length;
    } catch (e) {
      cam.devices = 1;
    }
    $('cam-flip').hidden = cam.devices < 2;
  } catch (e) {
    await camAsk();
    const note = $('cam-ask-note');
    note.textContent =
      e && e.name === 'NotAllowedError'
        ? camPolicyAllows()
          ? 'Permission was not given. To use the webcam, click the camera or lock icon in the address bar, set Camera to "Allow", then press "Allow webcam" again.'
          : note.textContent
        : e && e.name === 'NotFoundError'
          ? 'No webcam was found on this computer. Use a photo file instead.'
          : e && e.name === 'NotReadableError'
            ? 'The webcam is in use by another program. Close it and press "Allow webcam" again.'
            : `The webcam could not be started${e && e.name ? ` (${e.name})` : ''}. Press "Allow webcam" to try again, or use a photo file.`;
    note.hidden = false;
    if (e && e.name === 'NotAllowedError' && !camPolicyAllows()) $('cam-allow').hidden = true;
  }
}
// crop the guide square (70 % of the short side, centred) from a source of size w × h
function camCrop(src, w, h) {
  const side = Math.round(Math.min(w, h) * (src instanceof HTMLVideoElement ? 0.7 : 1)),
    out = Math.min(1024, side);
  const c = document.createElement('canvas');
  c.width = c.height = out;
  c.getContext('2d').drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out);
  return c;
}
function evenLighting(c) {
  const n = c.width,
    g = c.getContext('2d'),
    img = g.getImageData(0, 0, n, n),
    d = img.data;
  // illumination: the photo shrunk to 8 × 8 and smoothly scaled back up
  const s = document.createElement('canvas');
  s.width = s.height = 8;
  const sg = s.getContext('2d');
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(c, 0, 0, 8, 8);
  const L = document.createElement('canvas');
  L.width = L.height = n;
  const lg = L.getContext('2d');
  lg.imageSmoothingEnabled = true;
  lg.imageSmoothingQuality = 'high';
  lg.drawImage(s, 0, 0, n, n);
  const ld = lg.getImageData(0, 0, n, n).data;
  let mr = 0,
    mg = 0,
    mb = 0;
  const px = n * n;
  for (let i = 0; i < d.length; i += 4) {
    mr += ld[i];
    mg += ld[i + 1];
    mb += ld[i + 2];
  }
  mr /= px;
  mg /= px;
  mb /= px;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (ld[i] + ld[i + 1] + ld[i + 2]) / 3 || 1,
      mean = (mr + mg + mb) / 3,
      k = mean / lum;
    d[i] = Math.min(255, d[i] * k);
    d[i + 1] = Math.min(255, d[i + 1] * k);
    d[i + 2] = Math.min(255, d[i + 2] * k);
  }
  g.putImageData(img, 0, 0);
  return c;
}
function makeSeamless(c) {
  const n = c.width,
    h = n >> 1,
    g = c.getContext('2d'),
    A = g.getImageData(0, 0, n, n).data;
  const out = g.createImageData(n, n),
    o = out.data;
  const edge = (x, y) => Math.max(1e-3, Math.min(x, n - 1 - x, y, n - 1 - y) / h);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const xb = (x + h) % n,
        yb = (y + h) % n,
        ia = 4 * (y * n + x),
        ib = 4 * (yb * n + xb);
      const wa = edge(x, y) ** 2,
        wb = edge(xb, yb) ** 2,
        t = wa + wb;
      for (let k = 0; k < 3; k++) o[ia + k] = (A[ia + k] * wa + A[ib + k] * wb) / t;
      o[ia + 3] = 255;
    }
  g.putImageData(out, 0, 0);
  return c;
}
function camReview(c) {
  cam.shot = c;
  camStop();
  const v = $('cam-shot');
  v.width = c.width;
  v.height = c.height;
  v.getContext('2d').drawImage(c, 0, 0);
  v.hidden = false;
  $('cam-video').hidden = true;
  $('cam-guide').hidden = true;
  $('cam-live-row').hidden = true;
  $('cam-review').hidden = false;
  if (!$('cam-name').value)
    $('cam-name').value = `Photo fabric ${fabricLib.filter(f => f.id.startsWith('u')).length + 1}`;
  camMsg('Check the picture. Set how wide the square is on the real fabric, so the print shows at its true size.');
}
function openCamera() {
  const dlg = $('cam-dialog');
  $('cam-name').value = '';
  if (!dlg.open) {
    try {
      dlg.showModal();
    } catch (e) {
      dlg.setAttribute('open', '');
    }
  }
  camAsk();
}
function initCamera() {
  for (const b of document.querySelectorAll('.cam-open')) b.addEventListener('click', openCamera);
  $('cam-close').addEventListener('click', () => $('cam-dialog').close());
  $('cam-dialog').addEventListener('close', () => {
    camStop();
    setTimeout(() => {
      setCamTarget(null);
    }, 0);
  });
  $('cam-flip').addEventListener('click', () => {
    cam.facing = cam.facing === 'environment' ? 'user' : 'environment';
    camStart();
  });
  $('cam-snap').addEventListener('click', () => {
    const v = $('cam-video');
    if (!v.videoWidth) return;
    camReview(camCrop(v, v.videoWidth, v.videoHeight));
  });
  $('cam-file').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const im = await loadImage(URL.createObjectURL(f));
    camReview(camCrop(im, im.naturalWidth, im.naturalHeight));
  });
  $('cam-retake').addEventListener('click', () => (cam.hadLive ? camStart() : camAsk()));
  $('cam-allow').addEventListener('click', camStart);
  $('cam-file2').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const im = await loadImage(URL.createObjectURL(f));
    $('cam-ask').hidden = true;
    $('cam-viewbox').hidden = false;
    camReview(camCrop(im, im.naturalWidth, im.naturalHeight));
  });
  $('cam-use').addEventListener('click', () => {
    if (!cam.shot) return;
    const c = document.createElement('canvas');
    c.width = c.height = cam.shot.width;
    c.getContext('2d').drawImage(cam.shot, 0, 0);
    if ($('cam-fix').checked) makeSeamless(evenLighting(c));
    const cm = Math.max(3, Math.min(100, +$('cam-cm').value || 15));
    const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    fabricLib.push({ id, name: ($('cam-name').value || 'Photo fabric').slice(0, 40), canvas: c, cm });
    $('cam-dialog').close();
    // pick it straight away: applies to the selected parts, or waits for a selection
    if (camTarget) {
      const f = camTarget;
      setCamTarget(null);
      f(id);
    } else if (selParts.size) applyFabric(id);
    else {
      setActiveFabric(id);
      drawFabricPalette();
    }
    $('dz-fabnote').textContent = 'Fabric added from the camera. Photos are kept only until you reload the page.';
  });
}
initCamera();

export { openCamera };
