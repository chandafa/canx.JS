
import { initDatabase, closeDatabase, execute, query } from '../src/mvc/Model';
import { migrator } from '../src/database/Migration';
import { sessionStore } from '../src/auth/Auth';
import { DatabaseSessionDriver } from '../src/auth/drivers/DatabaseSessionDriver';
import '../src/database/migrations/20240114000000_create_sessions_table';

async function run() {
  console.log('--- Database Session Store Verification ---');

  // 1. Initialize DB (SQLite Memory)
  await initDatabase({
    driver: 'sqlite', // Use SQLite for fast local testing
    database: ':memory:',
    logging: false
  });
  console.log('[CanxJS] Database connected');

  // 2. Run Migrations
  await migrator.run();
  console.log('[Migration] Database migrated');

  // 3. Switch to Database Driver
  sessionStore.use(new DatabaseSessionDriver());
  console.log('[Session] Switched to DatabaseDriver');

  // 4. Create Session
  const userId = 101;
  const data = { role: 'admin', theme: 'dark' };
  const session = await sessionStore.create(userId, data);
  console.log('[Session] Created:', session.id);

  // 5. Verify in Database directly (Raw Query)
  const rows = await query('SELECT * FROM sessions WHERE id = ?', [session.id]) as any[];
  if (rows.length === 0) {
    console.error('❌ Session not found in database!');
    process.exit(1);
  }
  console.log('[DB Check] Session found in DB:', rows[0]);
  
  // Verify Payload
  const dbPayload = JSON.parse(rows[0].payload);
  if (dbPayload.role !== 'admin') {
     console.error('❌ Payload mismatch!', dbPayload);
     process.exit(1);
  }

  // 6. Retrieve via Driver
  const retrieved = await sessionStore.get(session.id);
  if (!retrieved) {
    console.error('❌ Failed to retrieve session via driver!');
    process.exit(1);
  }
  console.log('[Session] Retrieved:', retrieved);

  if (retrieved.userId != userId) {
    console.error(`❌ User ID mismatch! Expected ${userId}, got ${retrieved.userId}`);
    process.exit(1);
  }

  console.log('✅ Database Session Verification PASSED');
  
  await closeDatabase();
}

run().catch(console.error);
