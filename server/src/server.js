// Starts the API: reads the settings, brings the database up to date, listens.
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { migrate } from './migrate.js';
import { localStore, s3Store } from './objects.js';
import { buildApp } from './app.js';
import { startErrorReports } from './error-reports.js';

const config = loadConfig();
const reports = await startErrorReports(config.sentryDsn, { environment: config.env, release: config.release });
const pool = createPool(config.databaseUrl);
await migrate(pool);
const store = config.storage === 'local' ? localStore(config.localDir, config.publicUrl) : s3Store(config.s3);
const app = await buildApp({
  config,
  pool,
  store,
  logger: { level: config.env === 'production' ? 'info' : 'debug' },
  onError: reports.report,
});
if (config.auth === 'dev')
  app.log.warn(
    'Development login is on: any request with an X-Dev-User header is that user. Never use this in production.',
  );
if (config.auth0) app.log.info(`Sign-in with Auth0 (${config.auth0.domain}) for ${config.auth0.audience}.`);
else if (config.auth === 'none') app.log.warn('Sign-in is not set up (AUTH0_DOMAIN): every /v1 request is refused.');
if (config.storage === 'local') app.log.warn(`Photos are kept in ${config.localDir} (development storage).`);
await app.listen({ port: config.port, host: '0.0.0.0' });

for (const sig of ['SIGINT', 'SIGTERM'])
  process.on(sig, async () => {
    await app.close();
    await pool.end();
    await reports.close();
  });
