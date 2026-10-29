// Starts the API: reads the settings, brings the database up to date, listens.
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { migrate } from './migrate.js';
import { localStore, s3Store } from './objects.js';
import { buildApp } from './app.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
await migrate(pool);
const store = config.storage === 'local' ? localStore(config.localDir, config.publicUrl) : s3Store(config.s3);
const app = await buildApp({
  config,
  pool,
  store,
  logger: { level: config.env === 'production' ? 'info' : 'debug' },
});
if (config.auth === 'dev')
  app.log.warn(
    'Development login is on: any request with an X-Dev-User header is that user. Never use this in production.',
  );
if (config.storage === 'local') app.log.warn(`Photos are kept in ${config.localDir} (development storage).`);
await app.listen({ port: config.port, host: '0.0.0.0' });

for (const sig of ['SIGINT', 'SIGTERM'])
  process.on(sig, async () => {
    await app.close();
    await pool.end();
  });
