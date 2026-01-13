
import { initDatabase, execute, query, closeDatabase } from '../src/mvc/Model';
import { validateAsync } from '../src/utils/Validator';

async function test() {
  console.log('🚧 Initializing SQLite DB...');
  await initDatabase({
    driver: 'sqlite',
    database: ':memory:',
    logging: false
  });

  console.log('📦 Creating table users...');
  await execute(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      username TEXT NOT NULL
    )
  `);

  console.log('🌱 Seeding user...');
  await execute('INSERT INTO users (email, username) VALUES (?, ?)', ['john@example.com', 'johnny']);

  // Test 1: Unique (Should fail)
  console.log('\n🧪 Test 1: Unique rule (Should FAIL)');
  const result1 = await validateAsync({ email: 'john@example.com' }, {
    email: 'unique:users,email'
  });
  console.log('Valid:', result1.valid);
  console.log('Errors:', result1.errors);
  if (!result1.valid && result1.errors.get('email')?.[0]?.includes('taken')) {
    console.log('✅ PASSED');
  } else {
    console.error('❌ FAILED');
  }

  // Test 2: Unique (Should pass)
  console.log('\n🧪 Test 2: Unique rule (Should PASS)');
  const result2 = await validateAsync({ email: 'jane@example.com' }, {
    email: 'unique:users,email'
  });
  console.log('Valid:', result2.valid);
  if (result2.valid) {
    console.log('✅ PASSED');
  } else {
    console.error('❌ FAILED');
  }

  // Test 3: Exists (Should pass)
  console.log('\n🧪 Test 3: Exists rule (Should PASS)');
  const result3 = await validateAsync({ username: 'johnny' }, {
    username: 'exists:users,username'
  });
  console.log('Valid:', result3.valid);
  if (result3.valid) {
    console.log('✅ PASSED');
  } else {
    console.error('❌ FAILED');
  }

  // Test 4: Exists (Should fail)
  console.log('\n🧪 Test 4: Exists rule (Should FAIL)');
  const result4 = await validateAsync({ username: 'ghost' }, {
    username: 'exists:users,username'
  });
  console.log('Valid:', result4.valid);
  console.log('Errors:', result4.errors);
  if (!result4.valid) {
    console.log('✅ PASSED');
  } else {
    console.error('❌ FAILED');
  }

  await closeDatabase();
}

test().catch(console.error);
