// Settings from the environment (see .env.example). Read once at start-up; a missing or bad value stops the
// server with a clear message instead of failing later.

/**
 * @typedef {object} Config
 * @property {'development' | 'test' | 'production'} env
 * @property {number} port
 * @property {string} databaseUrl
 * @property {'dev' | 'none'} auth  'dev': the stand-in login (X-Dev-User header), never allowed in production
 * @property {string[]} corsOrigins  sites allowed to call the API from a browser
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
  return {
    env: nodeEnv,
    port: Number(env.PORT || 8787),
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
