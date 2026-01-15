import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { initDatabase, closeDatabase, query, execute } from "../src/mvc/Model";

describe("ORM / Database", () => {
  beforeAll(async () => {
    await initDatabase({
      driver: "sqlite",
      database: ":memory:",
    });

    // Create test table
    await execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        age INTEGER
      )
    `);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test("should insert and select data", async () => {
    const result = await execute("INSERT INTO users (name, email, age) VALUES (?, ?, ?)", ["John", "john@test.com", 30]);
    expect(result.affectedRows).toBe(1);
    
    const users = await query("SELECT * FROM users WHERE email = ?", ["john@test.com"]);
    expect(users.length).toBe(1);
    expect(users[0].name).toBe("John");
  });

  test("should update data", async () => {
    await execute("UPDATE users SET age = ? WHERE name = ?", [31, "John"]);
    
    const users = await query("SELECT age FROM users WHERE name = ?", ["John"]);
    expect(users[0].age).toBe(31);
  });

  test("should delete data", async () => {
    await execute("DELETE FROM users WHERE name = ?", ["John"]);
    
    const users = await query("SELECT * FROM users");
    expect(users.length).toBe(0);
  });
});
