import { describe, expect, test } from "bun:test";
import { validate, is } from "../src/utils/Validator";

describe("Validator", () => {
  test("should validate required fields", () => {
    const schema = { name: "required" };
    expect(validate({ name: "John" }, schema).valid).toBe(true);
    expect(validate({}, schema).valid).toBe(false);
    expect(validate({ name: "" }, schema).valid).toBe(false);
  });

  test("should validate email", () => {
    expect(is.email("test@example.com")).toBe(true);
    expect(is.email("invalid-email")).toBe(false);
  });

  test("should validate numbers", () => {
    const schema = { age: "number|min:18" };
    expect(validate({ age: 20 }, schema).valid).toBe(true);
    expect(validate({ age: 10 }, schema).valid).toBe(false);
    expect(validate({ age: "20" }, schema).valid).toBe(false); // Strict type check
  });

  test("should validate string length", () => {
    const schema = { username: "string|min:3|max:10" };
    expect(validate({ username: "user" }, schema).valid).toBe(true);
    expect(validate({ username: "ab" }, schema).valid).toBe(false);
    expect(validate({ username: "verylongusername" }, schema).valid).toBe(false);
  });

  test("should handle multiple rules", () => {
    const schema = {
        email: "required|email",
        age: "required|number|min:18"
    };
    
    const validData = { email: "test@test.com", age: 25 };
    const invalidData = { email: "bad", age: 10 };

    expect(validate(validData, schema).valid).toBe(true);
    expect(validate(invalidData, schema).valid).toBe(false);
    expect(validate(invalidData, schema).errors.get("email")).toBeDefined();
    expect(validate(invalidData, schema).errors.get("age")).toBeDefined();
  });
  
  test("should return validated data only", () => {
      const input = { name: "John", extra: "ignore me" };
      const schema = { name: "required" };
      const result = validate(input, schema);
      
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ name: "John" });
      expect((result.data as any).extra).toBeUndefined();
  });
});
