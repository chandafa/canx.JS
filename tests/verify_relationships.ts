
import { initDatabase, execute, closeDatabase, Model } from '../src/mvc/Model';

// Define Models
class User extends Model {
  static tableName = 'users';
}

class Post extends Model {
  static tableName = 'posts';
  
  user() {
    return this.belongsTo(User);
  }
}

class Profile extends Model {
  static tableName = 'profiles';
}

class Role extends Model {
  static tableName = 'roles';
}

// Re-open User to add relations (cyclic dependency workaround or just method def)
// In TS, we can just add methods to class
class UserExtended extends User {
  posts() {
    return this.hasMany(Post, 'user_id');
  }
  
  profile() {
    return this.hasOne(Profile, 'user_id');
  }
  
  roles() {
    return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');
  }
}

async function test() {
  console.log('🚧 Initializing SQLite DB...');
  await initDatabase({
    driver: 'sqlite',
    database: ':memory:',
    logging: false
  });

  // Schema
  await execute('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TEXT, updated_at TEXT)');
  await execute('CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, user_id INTEGER, created_at TEXT, updated_at TEXT)');
  await execute('CREATE TABLE profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, bio TEXT, user_id INTEGER, created_at TEXT, updated_at TEXT)');
  await execute('CREATE TABLE roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TEXT, updated_at TEXT)');
  await execute('CREATE TABLE user_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, role_id INTEGER, created_at TEXT, updated_at TEXT)');

  // Seed
  console.log('🌱 Seeding data...');
  const user1 = await UserExtended.create({ name: 'John Doe' });
  const user2 = await UserExtended.create({ name: 'Jane Doe' });
  
  await Post.create({ title: 'Post 1 by John', user_id: user1.id });
  await Post.create({ title: 'Post 2 by John', user_id: user1.id });
  await Post.create({ title: 'Post by Jane', user_id: user2.id });
  
  await Profile.create({ bio: 'I am John', user_id: user1.id });
  
  const roleAdmin = await Role.create({ name: 'Admin' });
  await execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [user1.id, roleAdmin.id]);

  // Test 1: hasMany
  console.log('\n🧪 Test 1: hasMany (User -> Posts)');
  const posts = await user1.posts().get();
  console.log(`User ${user1.name} has ${posts.length} posts.`);
  if (posts.length === 2 && posts[0] instanceof Post) {
    console.log('✅ PASSED');
  } else {
    console.error('❌ FAILED', posts);
  }

  // Test 2: belongsTo
  console.log('\n🧪 Test 2: belongsTo (Post -> User)');
  const post = posts[0];
  const author = await post.user();
  console.log(`Post "${post.title}" written by ${author?.name}`);
  if (author instanceof User && author.id === user1.id) {
    console.log('✅ PASSED');
  } else {
    console.error('❌ FAILED', author);
  }

  // Test 3: hasOne
  console.log('\n🧪 Test 3: hasOne (User -> Profile)');
  const profile = await user1.profile();
  console.log(`User bio: ${profile?.bio}`);
  if (profile instanceof Profile && profile.user_id === user1.id) {
    console.log('✅ PASSED');
  } else {
    console.error('❌ FAILED', profile);
  }

  // Test 4: belongsToMany
  console.log('\n🧪 Test 4: belongsToMany (User -> Roles)');
  const roles = await user1.roles().get();
  console.log(`User has roles: ${roles.map(r => r.name).join(', ')}`);
  if (roles.length === 1 && roles[0].name === 'Admin' && roles[0] instanceof Role) {
    console.log('✅ PASSED');
  } else {
    console.error('❌ FAILED', roles);
  }

  await closeDatabase();
}

test().catch(console.error);
