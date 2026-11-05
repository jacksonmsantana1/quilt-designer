// Getting a picture from the camera or the phone's photos. In the app it's Capacitor's camera; in a browser (working on
// the app on a computer, and in the tests) it's the file picker, which on a phone offers the camera too.
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNative } from './auth.js';
import { $ } from './ui.js';

/** @param {any} el @returns {Promise<Blob | null>} */
function fromPicker(el) {
  return new Promise(done => {
    const finish = file => {
      el.removeEventListener('change', changed);
      el.removeEventListener('cancel', cancelled);
      el.value = ''; // so that choosing the same file again counts
      done(file);
    };
    const changed = () => finish(el.files[0] || null);
    const cancelled = () => finish(null);
    el.addEventListener('change', changed);
    el.addEventListener('cancel', cancelled);
    el.click();
  });
}

/**
 * A picture, or null when the person changes their mind. Call it straight from a tap (browsers want that).
 * @param {{ gallery?: boolean }} [o] gallery: from the phone's photos instead of the camera @returns {Promise<Blob | null>}
 */
async function getPicture({ gallery = false } = {}) {
  if (!isNative()) return fromPicker($(gallery ? 'pick-gallery' : 'pick-camera'));
  try {
    const photo = await Camera.getPhoto({
      source: gallery ? CameraSource.Photos : CameraSource.Camera,
      resultType: CameraResultType.Uri, // a file, not the whole picture in memory as text
      quality: 92,
      saveToGallery: false,
      correctOrientation: true,
    });
    return await (await fetch(photo.webPath)).blob();
  } catch (e) {
    if (/cancel/i.test(e?.message || '')) return null;
    throw e;
  }
}

export { getPicture };
