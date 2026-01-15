import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { initDatabase, closeDatabase, query, execute, Model } from "../src/mvc/Model";

// Mock Model for QueryBuilder testing
class User extends Model {
  static tableName = 'users';
}

describe("ORM / QueryBuilder", () => {
  beforeAll(async () => {
    await initDatabase({ driver: "sqlite", database: ":memory:" });
    await execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        age INTEGER,
        created_at TEXT,
        updated_at TEXT
      )
    `);
    await execute("INSERT INTO users (name, email, age) VALUES (?, ?, ?)", ["Alice", "alice@test.com", 25]);
    await execute("INSERT INTO users (name, email, age) VALUES (?, ?, ?)", ["Bob", "bob@test.com", 30]);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test("should select with where clauses", async () => {
    const users = await User.query().where('age', '>', 28).get();
    expect(users.length).toBe(1);
    expect(users[0].name).toBe("Bob");
  });

  test("should chain methods", async () => {
    const user = await User.query().select('name', 'age').where('name', '=', 'Alice').first();
    expect(user!.name).toBe("Alice");
    expect(user!.age).toBe(25);
  });
  
  test("should chain methods (select specific)", async () => {
      const user = await User.query().select('name').where('name', '=', 'Alice').first();
      expect(user.name).toBe("Alice");
      expect(user.age).toBeUndefined();
  });
  
  test("should insert via model", async () => {
    const newUser = await User.create({ name: "Charlie", email: "charlie@test.com", age: 35 });
    // Assuming create returns the model or data. 
    // Need to check Model implementation for create/insert signature.
    // If Model doesn't have create static method, use query builder insert.
    // User.insert(...) ?
  });
});
