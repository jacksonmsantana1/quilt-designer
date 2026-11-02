// Stores the encrypted backups in their own bucket (scripts/backup.sh and restore.sh use it):
//   node backup-store.js put <file>           prints the name it was stored under
//   node backup-store.js get <name | latest> <file>
//   node backup-store.js list
//   node backup-store.js prune <days> <keep>
// Settings: BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY;
// BACKUP_S3_PATH_STYLE=true for SeaweedFS.
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import fs from 'node:fs';
import { backupName, backupsToDelete, newestBackup } from '../src/backups.js';

const need = k => {
  if (!process.env[k]) throw new Error(`${k} is not set`);
  return /** @type {string} */ (process.env[k]);
};
const Bucket = need('BACKUP_S3_BUCKET');
const s3 = new S3Client({
  region: 'auto',
  endpoint: need('BACKUP_S3_ENDPOINT'),
  forcePathStyle: process.env.BACKUP_S3_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: need('BACKUP_S3_ACCESS_KEY_ID'),
    secretAccessKey: need('BACKUP_S3_SECRET_ACCESS_KEY'),
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async function list() {
  const keys = [];
  let ContinuationToken;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: 'backups/', ContinuationToken }));
    keys.push(...(r.Contents || []).map(o => /** @type {string} */ (o.Key)));
    ContinuationToken = r.NextContinuationToken;
  } while (ContinuationToken);
  return keys;
}

const [what, a, b] = process.argv.slice(2);
if (what === 'put') {
  const Key = backupName();
  await s3.send(new PutObjectCommand({ Bucket, Key, Body: fs.readFileSync(a) }));
  console.log(Key);
} else if (what === 'get') {
  const Key = a === 'latest' ? newestBackup(await list()) : a;
  if (!Key) throw new Error('There are no backups.');
  const r = await s3.send(new GetObjectCommand({ Bucket, Key }));
  fs.writeFileSync(b, /** @type {any} */ (r.Body).transformToByteArray ? await r.Body.transformToByteArray() : '');
  console.log(Key);
} else if (what === 'list') {
  for (const k of (await list()).sort()) console.log(k);
} else if (what === 'prune') {
  const gone = backupsToDelete(await list(), Number(a), Number(b));
  for (const Key of gone) await s3.send(new DeleteObjectCommand({ Bucket, Key }));
  console.log(`${gone.length} old backup(s) removed.`);
} else throw new Error('Use: backup-store.js put | get | list | prune');
