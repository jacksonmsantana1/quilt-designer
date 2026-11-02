// Which nightly backups stay and which go (scripts/backup-store.js does the storing). Names are
// backups/<date and time>.dump.gpg, so they sort by age.

const NAME = /^backups\/(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})Z\.dump\.gpg$/;

/** A new backup's name. @param {Date} [now] */
export function backupName(now = new Date()) {
  return `backups/${now.toISOString().slice(0, 19).replace(/[:]/g, '')}Z.dump.gpg`;
}

/** When a backup was made, from its name (null: not one of ours). @param {string} key @returns {number | null} */
function madeAt(key) {
  const m = NAME.exec(key);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

/**
 * The backups to delete: older than `days`, but never the newest `keep`, so backups that stopped working can't let
 * the old ones run out. What isn't one of our names is left alone.
 * @param {string[]} keys @param {number} days @param {number} keep @param {number} [now] @returns {string[]}
 */
export function backupsToDelete(keys, days, keep, now = Date.now()) {
  const ours = keys.filter(k => madeAt(k) !== null).sort();
  const older = now - days * 24 * 60 * 60 * 1000;
  return ours.slice(0, Math.max(0, ours.length - keep)).filter(k => /** @type {number} */ (madeAt(k)) < older);
}

/** The newest backup's name. @param {string[]} keys @returns {string | null} */
export function newestBackup(keys) {
  return (
    keys
      .filter(k => madeAt(k) !== null)
      .sort()
      .at(-1) ?? null
  );
}
