import { describe, expect, test } from "bun:test";
import { autoCache, createAutoCache } from "../src/features/AutoCache";
import { createCanxRequest } from "../src/core/Server";

describe("AutoCache", () => {
    
    // We access private 'cache' or 'analyzer' using 'any' if needed,
    // but the public API get/set is better.

    test("should initially return null for new request", () => {
        const req = createCanxRequest(new Request("http://localhost/api/data"));
        const cached = autoCache.get(req);
        expect(cached).toBeNull();
    });

    test("should not cache POST requests", async () => {
        const cache = createAutoCache();
        const req = createCanxRequest(new Request("http://localhost/api/submit", { method: "POST" }));
        const res = new Response("ok");
        
        await cache.set(req, res, 50); // duration 50ms
        
        const cached = cache.get(req);
        expect(cached).toBeNull();
    });

    test("should cache frequently accessed GET requests (simulation)", async () => {
        const cache = createAutoCache({ enabled: true, defaultTtl: 60 });
        const url = "http://localhost/api/popular";
        
        // Simulate multiple hits to trigger smart caching (PatternAnalyzer needs > 10 hits OR > 100ms duration)
        // Let's use slow duration to trigger it immediately
        
        const req = createCanxRequest(new Request(url));
        const res = new Response("Cached Data", { headers: { "Content-Type": "text/plain" } });
        
        // First set - slow request (150ms) -> Analyzed as cacheable
        await cache.set(req, res, 150);
        
        // Second get - should be in cache
        const cached = cache.get(req);
        
        // Note: AutoCache logic: analyze() stores stats. 
        // If it returns true (cacheable), THEN we store it in LRUCache.
        // PatternAnalyzer: if (duration > 100) -> cacheable = true
        
        // So second call to set() or just checking get()?
        // Wait, cache.set() calls analyzer. 
        // If analyzer says 'true', it stores in cache.
        // So after ONE slow request, it should be cached? 
        // Let's check logic:
        // if (existing.hits > 10 || existing.avgDuration > 100) existing.cacheable = true;
        // set() calls analyze(). If true, it caches.
        
        // First call: hits=1, duration=150. avg=150. > 100 -> true.
        // So it SHOULD cache immediately.
        
        expect(cached).not.toBeNull();
        expect(await cached?.text()).toBe("Cached Data");
        expect(cached?.headers.get("X-Cache")).toBe("HIT");
    });

    test("should support exclusion patterns", async () => {
        const cache = createAutoCache({ 
            enabled: true,
            exclude: ['/api/private/*'] 
        });
        
        const req = createCanxRequest(new Request("http://localhost/api/private/user"));
        const res = new Response("Secret");
        
        await cache.set(req, res, 200); // Slow request
        
        const cached = cache.get(req);
        expect(cached).toBeNull();
    });
});
