import { describe, expect, test, beforeAll } from "bun:test";
import { 
  hashPassword, 
  verifyPassword, 
  signJWT, 
  verifyJWT,
  sessionStore,
  jwtAuth,
  sessionAuth, 
  MemorySessionDriver
} from "../src/auth/Auth";
import { createCanxRequest, createCanxResponse } from "../src/core/Server";

describe("Auth System", () => {
    
    describe("Password Hashing", () => {
        test("should hash password correctly", async () => {
            const password = "password123";
            const hash = await hashPassword(password);
            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(10);
        });

        test("should verify correct password", async () => {
            const password = "password123";
            const hash = await hashPassword(password);
            const isValid = await verifyPassword(password, hash);
            expect(isValid).toBe(true);
        });

        test("should reject incorrect password", async () => {
            const password = "password123";
            const hash = await hashPassword(password);
            const isValid = await verifyPassword("wrongpassword", hash);
            expect(isValid).toBe(false);
        });
    });

    describe("JWT", () => {
        const secret = "super-secret-key-123";
        const payload = { sub: "user_123", role: "admin" };

        test("should sign and verify JWT", async () => {
            const token = await signJWT(payload, { secret });
            expect(token).toBeDefined();
            expect(token.split('.').length).toBe(3);

            const decoded = await verifyJWT(token, { secret });
            expect(decoded).not.toBeNull();
            expect(decoded?.sub).toBe(payload.sub);
            expect(decoded?.role).toBe(payload.role);
        });

        test("should reject invalid signature", async () => {
            const token = await signJWT(payload, { secret });
            const decoded = await verifyJWT(token, { secret: "wrong-secret" });
            expect(decoded).toBeNull();
        });

        // Expired token test would require mocking time or waiting, skipping for unit speed
    });

    describe("Session Management", () => {
        beforeAll(() => {
            // Ensure we use memory driver
             sessionStore.use(new MemorySessionDriver());
        });

        test("should create and retrieve session", async () => {
            const userId = "user_456";
            const data = { name: "Alice" };
            const session = await sessionStore.create(userId, data);
            
            expect(session).toBeDefined();
            expect(session.userId).toBe(userId);
            expect(session.data.name).toBe(data.name);

            const retrieved = await sessionStore.get(session.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.id).toBe(session.id);
        });

        test("should destroy session", async () => {
            const session = await sessionStore.create("user_789");
            const deleted = await sessionStore.destroy(session.id);
            expect(deleted).toBe(true);

            const retrieved = await sessionStore.get(session.id);
            expect(retrieved).toBeNull();
        });
    });

     describe("Middleware", () => {
        test("jwtAuth should attach user context on valid token", async () => {
            const secret = "middleware-secret";
            const token = await signJWT({ sub: "user_1" }, { secret });
            
            const req = createCanxRequest(new Request("http://localhost/", {
                headers: { "Authorization": `Bearer ${token}` }
            }));
            const res = createCanxResponse();
            const next = () => Promise.resolve(new Response("OK"));

            const middleware = jwtAuth({ secret });
            await middleware(req, res, next);

            const user = req.context.get('user');
            expect(user).toBeDefined();
            expect(user.sub).toBe("user_1");
        });

        test("jwtAuth should return 401 on missing token", async () => {
             const req = createCanxRequest(new Request("http://localhost/"));
             const res = createCanxResponse();
             const next = () => Promise.resolve(new Response("OK"));
 
             const middleware = jwtAuth({ secret: "s" });
             const response = await middleware(req, res, next);
 
             // Ideally middleware returns Response object directly when failing
             expect(response).toBeDefined();
             expect(response?.status).toBe(401);
        });
     });
});
