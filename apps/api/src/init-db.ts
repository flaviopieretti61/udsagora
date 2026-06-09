export async function initializeDatabase() {
  // Migrations are managed manually via Prisma CLI in both dev and prod.
  // To apply pending migrations: pnpm --filter @udsagora/api db:migrate:deploy
  console.log('[db] Initialization complete (migrations not run automatically)');
}
