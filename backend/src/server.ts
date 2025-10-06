import 'dotenv/config';
import { createApp } from './app.js';
import { config } from './config.js';
import { initDatabase } from './db.js';

async function bootstrap() {
  await initDatabase();
  const app = createApp();

  app.listen(config.port, () => {
    console.log(`[mini-kms] listening on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('[mini-kms] failed to start server', error);
  process.exit(1);
});
