import { describe, expect, test } from "bun:test";
import { jitCompiler } from "../src/features/JITCompiler";

describe("JITCompiler", () => {
  let jit: any;

  // Use fresh instance
  const { createJITCompiler } = require('../src/features/JITCompiler');

  test("should compile and match static routes", () => {
    jit = createJITCompiler();
    const handler = () => "hello";
    jit.compile("GET", "/hello", handler);

    const match = jit.match("GET", "/hello");
    expect(match).not.toBeNull();
    expect(match?.handler).toBeDefined();
    
    // Pass mock req because optimized handler sets req.params
    const req = {}; 
    expect(match?.handler(req, null, [])).toBe("hello");
  });

  test("should compile and match dynamic routes", () => {
    jit = createJITCompiler();
    const handler = (req: any) => `User ${req.params.id}`;
    jit.compile("GET", "/users/:id", handler);

    const match = jit.match("GET", "/users/123");
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: "123" });
  });

  test("should handle multiple parameters", () => {
    jit = createJITCompiler();
    const handler = () => {};
    jit.compile("GET", "/posts/:postId/comments/:commentId", handler);

    const match = jit.match("GET", "/posts/1/comments/99");
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ postId: "1", commentId: "99" });
  });

  test("should return null for non-matching routes", () => {
    jit = createJITCompiler();
    jit.compile("GET", "/foo", () => {});
    expect(jit.match("GET", "/bar")).toBeNull();
    expect(jit.match("POST", "/foo")).toBeNull();
  });
  
  test("should collect stats", () => {
      jit = createJITCompiler();
      jit.compile("GET", "/one", () => {}); // Miss
      
      // Compile same again to trigger Hit
      jit.compile("GET", "/one", () => {}); // Hit
      
      const stats = jit.getStats();
      expect(stats.compiledRoutes).toBe(1); // Set size? logic says: if hit, returns cache. compiledRoutes++ only on miss.
      expect(stats.cacheHits).toBe(1);
  });
});
