import { env } from './config/env.js';
import { createApp } from './app.js';
import { initializeDatabase } from './init-db.js';

(async () => {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('[db] Database initialization error:', error);
    // Continue anyway - migrations might already be applied
  }

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`[api] UdsAgora API in ascolto su http://localhost:${env.PORT}`);
  });
})();
