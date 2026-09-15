import rooms from '../../migrations/0001_sessions_rooms.sql?raw';
import accounts from '../../migrations/0002_better_auth.sql?raw';

/** Applies the real D1 migrations, so Worker tests exercise the deployed schema. */
export async function applyMigrations(db: D1Database): Promise<void> {
  for (const sql of [rooms, accounts]) {
    const statements = sql.replace(/^\s*--.*$/gm, '').split(';').map(statement => statement.trim()).filter(Boolean);
    await db.batch(statements.map(statement => db.prepare(statement)));
  }
}
