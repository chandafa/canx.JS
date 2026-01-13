import { Model, initDatabase, closeDatabase } from '../src/mvc/Model';
import { Schema, migrator } from '../src/database/Migration';

// Define Models
class User extends Model {
  static tableName = 'users';
  
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

class Post extends Model {
  static tableName = 'posts';
  
  user() {
    return this.belongsTo(User, 'user_id');
  }
}

async function run() {
  console.log('--- Eager Loading Verification ---');
  await initDatabase({
    driver: 'sqlite',
    database: ':memory:',
    logging: false // Turn off for cleaner output, check logic manually first
  });
  
  // 1. Setup Schema
  await Schema.create('users', (table) => {
    table.id();
    table.string('name');
    table.timestamps();
  });
  
  await Schema.create('posts', (table) => {
    table.id();
    table.integer('user_id');
    table.string('title');
    table.timestamps();
  });
  
  // 2. Seed Data
  console.log('Seeding data...');
  const u1 = await User.create({ name: 'User 1' });
  const u2 = await User.create({ name: 'User 2' });
  
  await Post.create({ user_id: u1.id, title: 'U1 Post A' });
  await Post.create({ user_id: u1.id, title: 'U1 Post B' });
  await Post.create({ user_id: u2.id, title: 'U2 Post C' });
  
  // 3. Verify Eager Loading (with)
  console.log('\nTesting User.with("posts").get()...');
  const users = await User.with('posts').get();
  
  console.log(`Fetched ${users.length} users.`);
  
  let success = true;
  
  // Check User 1
  const user1 = users.find(u => u.id === u1.id);
  // Type assertion or manual check since we don't have types generated
  const u1Posts = user1?.relations['posts'] || [];
  console.log(`User 1 has ${u1Posts.length} posts (Expected: 2)`);
  if (u1Posts.length !== 2) success = false;
  if (!u1Posts.find((p: any) => p.title === 'U1 Post A')) success = false;
  
  // Check User 2
  const user2 = users.find(u => u.id === u2.id);
  const u2Posts = user2?.relations['posts'] || [];
  console.log(`User 2 has ${u2Posts.length} posts (Expected: 1)`);
  if (u2Posts.length !== 1) success = false;
  if (u2Posts[0].title !== 'U2 Post C') success = false;

  // 4. Verify Lazy Eager Loading (load)
  console.log('\nTesting Lazy Loading: user.load("posts")...');
  const freshUser1 = await User.find(u1.id);
  if (!freshUser1) {
     console.error('User 1 not found');
     success = false;
  } else {
     if (freshUser1.relations['posts']) {
        console.error('FAIL: Relations should be empty initially');
        success = false;
     }
     
     await freshUser1.load('posts');
     const loadedPosts = freshUser1.relations['posts'];
     console.log(`Loaded ${loadedPosts?.length} posts via load() (Expected: 2)`);
     if (loadedPosts?.length !== 2) success = false;
  }
  
  // 5. Verify belongsTo eager loading
  console.log('\nTesting Post.with("user").get()...');
  const posts = await Post.with('user').get();
  const p1 = posts.find((p: any) => p.title === 'U1 Post A');
  const p1User = p1?.relations['user'];
  console.log(`Post A belongs to user: ${p1User?.name} (Expected: User 1)`);
  if (p1User?.name !== 'User 1') success = false;

  if (success) {
    console.log('\n✅ Eager Loading Verification PASSED');
  } else {
    console.error('\n❌ Eager Loading Verification FAILED');
  }

  await closeDatabase();
}

run().catch(console.error);
