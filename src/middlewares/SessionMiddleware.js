"use strict";
/**
 * Session Middleware
 * Automatically handles session creation, persistence, and cookie management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionMiddleware = SessionMiddleware;
const Session_1 = require("../core/Session");
function SessionMiddleware(config = {}) {
    const sessionStore = new Session_1.Session(config);
    return async (req, res, next) => {
        // 1. Get Session ID from Cookie
        const cookieName = config.cookie || 'canx_session';
        const sessionId = req.cookie(cookieName);
        // 2. Start Session
        const id = await sessionStore.start(sessionId);
        // 3. Attach to Request
        req.session = sessionStore;
        // 4. Continue Request
        const response = await next();
        // 5. Save Session
        await sessionStore.save();
        // 6. Set Cookie (if changed or new)
        if (id) {
            // If response is a Response object, we need to clone/mutate headers?
            // CanxResponse methods wrap the native Response construction.
            // If manual Response is returned, we might miss the cookie if we don't handle it.
            // However, `res.cookie` adds to internal state which is used when `res.json/html` is called.
            // If `next()` returns a Response object directly, we can't easily append Set-Cookie header 
            // without creating a new Response (immutable headers in some environments, but Bun Headers are mutable).
            if (response instanceof Response) {
                // Append cookie header
                // Note: This matches the default simple cookie options. 
                // Production should use secure, httpOnly, etc. from config.
                const cookieStr = `${cookieName}=${id}; Path=/; HttpOnly; SameSite=Lax`;
                response.headers.append('Set-Cookie', cookieStr);
            }
            else {
                // set on res object if response not yet built (rare case here as next returns response)
                res.cookie(cookieName, id, {
                    httpOnly: true,
                    path: '/',
                    sameSite: 'Lax'
                });
            }
        }
        return response;
    };
}
