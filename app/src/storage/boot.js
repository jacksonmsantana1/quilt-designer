// Opens the storage before anything else runs: the top-level await holds back every module after this one in the
// load order (they read saved designs and settings as they load), so the app starts with its data in memory.
import * as repo from './repo.js';
import { flush, isPersistent, onStorageError, openStorage } from './repo.js';
import { notify } from '../ui/notice.js';

onStorageError(() =>
  notify('Your quilt could not be saved: this browser’s storage for the page may be full. Delete some old designs.'),
);
await openStorage();
if (!isPersistent())
  setTimeout(
    () => notify('This browser is not letting the page keep data, so your quilts will be lost when you close it.'),
    800,
  );
// write anything pending before the page goes away
addEventListener('pagehide', () => flush());
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
// the browser tests read what is saved through this
try {
  if (localStorage.getItem('quilt-freeze.v1') === '1') globalThis.__quiltStorage = repo;
} catch (e) {}
