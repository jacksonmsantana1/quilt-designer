// The app's basic fabrics: photographs of real cloth, some recoloured, and one print drawn in code. Shared by the web app
// and the phone app. No side effects when loaded; the pictures are made when asked for, in a browser.
import { t } from './i18n.js';

/** @param {string} src @returns {Promise<HTMLImageElement>} */
const loadImage = src =>
  new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = fail;
    im.src = src;
  });

const BUNDLED = [
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#efe5cf', name: t('Cream cotton') },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#2f466f', name: t('Indigo cotton'), binding: true },
  { src: 'assets/fabric/paisley.jpg', cm: 45, name: t('Woven paisley') },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#c79a45', name: t('Mustard cotton') },
  { src: 'assets/fabric/linen.jpg', cm: 22, name: t('Red linen') },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#7d8f70', name: t('Sage cotton') },
  { src: 'assets/fabric/stripe.jpg', cm: 22, name: t('Chenille stripe') },
  { src: 'assets/fabric/damask.jpg', cm: 30, name: t('Damask') },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#b26a5f', name: t('Rose cotton') },
  // for medallion and sampler quilts
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#a8c8b5', name: t('Mint cotton') },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#4a2c22', name: t('Chocolate cotton') },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#f8f6f0', name: t('White cotton') },
  { floral: true, cm: 40, name: t('Floral print') },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#9b7f78', name: t('Mocha cotton') },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#3f6b6b', name: t('Teal cotton') },
];
// A printed floral (white magnolias and dusky roses with leaves on a warm taupe ground), drawn once as a seamless tile.
function floralTile() {
  const N = 768,
    c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#d6ccbb';
  g.fillRect(0, 0, N, N);
  // soft mottling of the ground
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '255,250,240' : '150,135,115'},${0.05 + rnd() * 0.06})`;
    const x = rnd() * N,
      y = rnd() * N,
      r = 10 + rnd() * 40;
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  }
  const wrap = (x, y, draw) => {
    for (const dx of [-N, 0, N])
      for (const dy of [-N, 0, N]) {
        g.save();
        g.translate(x + dx, y + dy);
        draw();
        g.restore();
      }
  };
  const leaf = (a, L, col) => {
    g.save();
    g.rotate(a);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(L * 0.5, -L * 0.28, L, 0);
    g.quadraticCurveTo(L * 0.5, L * 0.28, 0, 0);
    g.fill();
    g.strokeStyle = 'rgba(40,60,40,.35)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(L * 0.9, 0);
    g.stroke();
    g.restore();
  };
  const magnolia = r => {
    for (let k = 0; k < 6; k++) {
      g.save();
      g.rotate((k * Math.PI) / 3 + 0.2);
      const gr = g.createLinearGradient(0, 0, 0, -r);
      gr.addColorStop(0, '#e9e2d2');
      gr.addColorStop(1, '#fbfaf6');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(0, -r * 0.5, r * 0.32, r * 0.55, 0, 0, 7);
      g.fill();
      g.strokeStyle = 'rgba(120,110,90,.35)';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
    g.fillStyle = '#c9b56a';
    g.beginPath();
    g.arc(0, 0, r * 0.16, 0, 7);
    g.fill();
  };
  const rose = r => {
    g.fillStyle = '#8a5a66';
    g.beginPath();
    g.arc(0, 0, r, 0, 7);
    g.fill();
    for (let k = 0; k < 5; k++) {
      g.strokeStyle = `rgba(${200 - k * 18},${150 - k * 12},${160 - k * 12},.8)`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, r * (0.85 - k * 0.15), k, k + 4.2);
      g.stroke();
    }
  };
  const motifs = [];
  for (let i = 0; i < 9; i++)
    motifs.push({
      x: (((i % 3) + rnd() * 0.6) * N) / 3,
      y: ((Math.floor(i / 3) + rnd() * 0.6) * N) / 3,
      kind: i % 3 === 1 ? 'rose' : 'mag',
      r: 34 + rnd() * 22,
      a: rnd() * 6.28,
    });
  for (const m of motifs)
    wrap(m.x, m.y, () => {
      for (let k = 0; k < 4; k++)
        leaf(m.a + k * 1.7 + rnd() * 0.4, m.r * (1.5 + rnd() * 0.6), k % 2 ? '#7d9a7e' : '#5f7c63');
    });
  for (const m of motifs)
    wrap(m.x, m.y, () => {
      g.rotate(m.a);
      m.kind === 'rose' ? rose(m.r * 0.55) : magnolia(m.r);
    });
  return c;
}
async function prepareSwatch(def) {
  const img = def.img || (def.floral ? floralTile() : await loadImage(def.src));
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  if (def.tint) {
    // Recolour the photographed weave: multiply keeps its real texture.
    g.fillStyle = def.tint;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'destination-over';
  } else g.drawImage(img, 0, 0);
  return { ...def, canvas: c };
}

export { BUNDLED, prepareSwatch };
