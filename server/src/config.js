// Settings from the environment (see .env.example). Read once at start-up; a missing or bad value stops the
// server with a clear message instead of failing later.

/**
 * @typedef {object} Config
 * @property {'development' | 'test' | 'production'} env
 * @property {number} port
 * @property {string} databaseUrl
 * @property {'dev' | 'none'} auth  'dev': the stand-in login (X-Dev-User header), never allowed in production
 * @property {string[]} corsOrigins  sites allowed to call the API from a browser
 * @property {'s3' | 'local'} storage  where photos are kept: S3/R2/MinIO, or (development only) a folder served by the API
 * @property {string} localDir  the folder for STORAGE=local
 * @property {string} publicUrl  the API's address as browsers see it (for STORAGE=local links)
 * @property {{ endpoint?: string, region: string, bucket: string, accessKeyId: string, secretAccessKey: string, forcePathStyle: boolean }} s3
 * @property {number} maxDesignBytes
 * @property {number} maxFabricBytes
 */

/** @param {Record<string, string | undefined>} [env] @returns {Config} */
export function loadConfig(env = process.env) {
  const nodeEnv = /** @type {Config['env']} */ (env.NODE_ENV || 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv))
    throw new Error(`NODE_ENV must be development, test or production, not "${nodeEnv}"`);
  const auth = /** @type {Config['auth']} */ (env.AUTH_MODE || (nodeEnv === 'production' ? 'none' : 'dev'));
  if (auth === 'dev' && nodeEnv === 'production')
    throw new Error('AUTH_MODE=dev (the stand-in login) cannot be used with NODE_ENV=production');
  if (!['dev', 'none'].includes(auth)) throw new Error(`AUTH_MODE must be dev or none, not "${auth}"`);
  const need = k => {
    if (!env[k]) throw new Error(`${k} is not set (see server/.env.example)`);
    return /** @type {string} */ (env[k]);
  };
  const storage = /** @type {Config['storage']} */ (
    env.STORAGE || (env.S3_ENDPOINT || nodeEnv === 'production' ? 's3' : 'local')
  );
  if (!['s3', 'local'].includes(storage)) throw new Error(`STORAGE must be s3 or local, not "${storage}"`);
  if (storage === 'local' && nodeEnv === 'production')
    throw new Error('STORAGE=local (photos in a folder served by the API) cannot be used with NODE_ENV=production');
  const port = Number(env.PORT || 8787);
  return {
    env: nodeEnv,
    storage,
    localDir: env.LOCAL_STORAGE_DIR || '.data/photos',
    publicUrl: env.PUBLIC_URL || `http://localhost:${port}`,
    port,
    databaseUrl: need('DATABASE_URL'),
    auth,
    corsOrigins: (env.CORS_ORIGINS || 'http://localhost:8000')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    s3: {
      endpoint: env.S3_ENDPOINT || undefined,
      region: env.S3_REGION || 'auto',
      bucket: env.S3_BUCKET || 'quilt-fabrics',
      accessKeyId: env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
      forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
    },
    maxDesignBytes: 2 * 1024 * 1024,
    maxFabricBytes: 15 * 1024 * 1024,
  };
}
