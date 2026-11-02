// Which nightly backups are kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupName, backupsToDelete, newestBackup } from '../src/backups.js';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 30, 6);
const nights = n => Array.from({ length: n }, (_, i) => backupName(new Date(now - i * DAY)));

test('a backup’s name says when it was made, and sorts by age', () => {
  assert.equal(backupName(new Date(now)), 'backups/2026-11-30T060000Z.dump.gpg');
  assert.equal(newestBackup(nights(3).reverse()), backupName(new Date(now)));
  assert.equal(newestBackup([]), null);
});

test('backups older than the days kept go, the others stay', () => {
  const gone = backupsToDelete(nights(35), 30, 7, now);
  assert.deepEqual(gone.sort(), nights(35).slice(31).sort());
});

test('the last ones always stay, however old: backups that stopped working can’t let them run out', () => {
  const old = nights(10).map((_, i) => backupName(new Date(now - (100 + i) * DAY)));
  assert.equal(backupsToDelete(old, 30, 7, now).length, 3);
  assert.deepEqual(backupsToDelete(old.slice(0, 7), 30, 7, now), []);
});

test('what isn’t one of our backups is left alone', () => {
  assert.deepEqual(backupsToDelete(['backups/notes.txt', 'backups/1990.dump.gpg'], 30, 0, now), []);
  assert.equal(newestBackup(['backups/notes.txt']), null);
});
