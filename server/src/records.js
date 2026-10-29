// Rows as the API sends them (the same fields the app keeps in IndexedDB, see app/src/storage/repo.js).

/** @param {any} r a designs row */
export const designRecord = r => ({
  kind: 'design',
  id: r.id,
  name: r.name,
  design: r.deleted ? null : r.doc,
  rev: r.rev,
  seq: r.seq,
  deleted: r.deleted,
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});

/** @param {any} r a fabrics row */
export const fabricRecord = r => ({
  kind: 'fabric',
  id: r.id,
  name: r.name,
  cm: r.cm,
  type: r.type,
  bytes: r.bytes,
  rev: r.rev,
  seq: r.seq,
  deleted: r.deleted,
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});

/** An error the API answers with: { error, message } and the HTTP status. */
export class ApiError extends Error {
  /** @param {number} status @param {string} code @param {string} message @param {object} [extra] */
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
