// Settings from the environment (see .env.example). Read once at start-up; a missing or bad value stops the
// server with a clear message instead of failing later.

/**
 * @typedef {object} Config
 * @property {'development' | 'test' | 'production'} env
 * @property {number} port
 * @property {string} databaseUrl
 * @property {'dev' | 'auth0' | 'none'} auth  'auth0': Auth0's signed tokens (Authorization: Bearer); 'dev': the stand-in
 *   login (X-Dev-User header, and Auth0 tokens too when Auth0 is set up), never allowed in production
 * @property {{ domain: string, audience: string } | null} auth0  the Auth0 tenant and this API's identifier there
 * @property {string[]} corsOrigins  sites allowed to call the API from a browser
 * @property {'s3' | 'local'} storage  where photos are kept: S3/R2/SeaweedFS, or (development only) a folder served by the API
 * @property {string} localDir  the folder for STORAGE=local
 * @property {string} publicUrl  the API's address as browsers see it (for STORAGE=local links)
 * @property {{ endpoint?: string, region: string, bucket: string, accessKeyId: string, secretAccessKey: string, forcePathStyle: boolean }} s3
 * @property {number} maxDesignBytes
 * @property {number} maxFabricBytes
 * @property {number} maxSharedBytes  how large a quilt shared with the community can be
 * @property {{ photoBytes: number, designs: number, shared: number }} perPerson  what one account can keep
 * @property {number} ratePerMinute  requests one person (or address, before signing in) can make in a minute
 * @property {string | null} clientIpHeader  the header the host's proxy puts the visitor's address in
 */

/** @param {Record<string, string | undefined>} [env] @returns {Config} */
export function loadConfig(env = process.env) {
  const nodeEnv = /** @type {Config['env']} */ (env.NODE_ENV || 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv))
    throw new Error(`NODE_ENV must be development, test or production, not "${nodeEnv}"`);
  const auth0 = env.AUTH0_DOMAIN
    ? { domain: env.AUTH0_DOMAIN.replace(/^https:\/\//, '').replace(/\/+$/, ''), audience: env.AUTH0_AUDIENCE || '' }
    : null;
  // the stand-in login only when asked for by name: a forgotten setting must never leave the door open
  const auth = /** @type {Config['auth']} */ (env.AUTH_MODE || (auth0 ? 'auth0' : 'none'));
  if (auth === 'dev' && nodeEnv === 'production')
    throw new Error('AUTH_MODE=dev (the stand-in login) cannot be used with NODE_ENV=production');
  if (!['dev', 'auth0', 'none'].includes(auth)) throw new Error(`AUTH_MODE must be dev, auth0 or none, not "${auth}"`);
  if (auth === 'auth0' && !auth0) throw new Error('AUTH_MODE=auth0 needs AUTH0_DOMAIN (see server/.env.example)');
  if (auth0 && !auth0.audience) throw new Error('AUTH0_AUDIENCE is not set (the API identifier in Auth0)');
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
  const positive = (k, otherwise) => {
    const v = env[k] === undefined ? otherwise : Number(env[k]);
    if (!Number.isFinite(v) || v <= 0) throw new Error(`${k} must be a positive number, not "${env[k]}"`);
    return v;
  };
  return {
    env: nodeEnv,
    storage,
    localDir: env.LOCAL_STORAGE_DIR || '.data/photos',
    publicUrl: env.PUBLIC_URL || `http://localhost:${port}`,
    port,
    databaseUrl: need('DATABASE_URL'),
    auth,
    auth0,
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
    maxSharedBytes: 512 * 1024,
    perPerson: {
      photoBytes: positive('MAX_PHOTO_MB_PER_PERSON', 1024) * 1024 * 1024,
      designs: positive('MAX_DESIGNS_PER_PERSON', 2000),
      shared: positive('MAX_SHARED_PER_PERSON', 200),
    },
    // the first sync of a large collection sends a lot at once; the seed script, far more
    ratePerMinute: positive('RATE_LIMIT_PER_MINUTE', auth === 'dev' ? 6000 : 600),
    clientIpHeader: env.CLIENT_IP_HEADER ? env.CLIENT_IP_HEADER.toLowerCase() : null,
  };
}
