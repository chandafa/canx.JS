# Changelog

## [1.8.0] - 2026-07-04

Major capability release closing the remaining gaps toward Laravel/NestJS parity.
No breaking changes — every addition is additive.

### ORM

- **Transactions & locking**: `transaction(cb)` (AsyncLocalStorage-scoped, nested via
  SAVEPOINTs), manual `beginTransaction()/commit()/rollBack()`, and a `DB` facade.
  `QueryBuilder.lockForUpdate()` / `sharedLock()` (MySQL/Postgres; no-op on SQLite).
- **Relationship-aware querying**: `whereHas` / `orWhereHas` / `whereDoesntHave` /
  `orWhereDoesntHave` via correlated `EXISTS` subqueries.
- **Write helpers**: `upsert()`, `insertOrIgnore()`, and static `updateOrCreate()`,
  `firstOrCreate()`, `firstOrNew()`, `updateOrInsert()`.
- **Large datasets**: `chunk()`, `cursor()`, `lazy()`, `each()` (paged streaming).
- **Query builder**: nested `where(cb)` groups, `where(col, val)` 2-arg shorthand,
  `whereNotIn`, `orWhereIn`, `whereBetween/whereNotBetween`, `orWhereNull/orWhereNotNull`,
  `whereIn(subquery)`, `min()`, `max()`, `exists()`, `remember()` query cache.
- **Relations**: `morphedByMany()` (inverse polymorphic).
- **Read replicas**: optional `read` config routes non-transactional SELECTs to a replica.

### Drivers & infrastructure

- **Cache**: `RedisCacheDriver` (implements `CacheDriver`).
- **Queue**: `SyncDriver` + `DatabaseDriver`; `redis` connection is now auto-selected
  from config when a client is provided.
- **Session**: `RedisSessionDriver` + `DatabaseSessionDriver` for `core/Session`.
- **Mail**: real dependency-free **SMTP** transport (implicit TLS/AUTH/MAIL/RCPT/DATA),
  plus `ArrayDriver` (test fake), `MailgunDriver`, and `SesDriver`.
- **Broadcasting**: fixed the fatal Pusher MD5 crash (pure-JS RFC-1321 MD5); added
  `RedisBroadcastDriver` (pub/sub fan-out across nodes).
- **Migrations**: `hasTable`/`hasColumn`/`reset()` are now driver-aware (no more
  MySQL-only `SHOW`/`TRUNCATE` on SQLite/Postgres).

### Security & auth

- **Signed URLs**: `signUrl`, `signedRoute`, `temporarySignedUrl`, `hasValidSignature`,
  `requireValidSignature` middleware (HMAC-SHA256, tamper-proof, expiring). Local storage
  `temporaryUrl()` is now HMAC-signed (was a forgeable base64 token).
- **Auth**: closed the residual cross-request `currentUser` leak — within a request the
  user is read only from the per-request context. Added `setUser/login/logout/id`.
- **Error handling**: production 5xx responses no longer leak internal error messages
  (4xx client errors still surface their message).

### CLI & testing

- **CLI**: new `db:seed` command; `migrate fresh --seed`; fixed the `make:seeder`
  template (registered a bad `defineSeeder(fn)` call — now `defineSeeder(name, fn)`).
- **Fixed a dual-module bug**: `migrator` and `seeder` singletons now live on
  `globalThis`, so migrations/seeders registered through the `canxjs` package junction
  are visible to the CLI (previously "Nothing to migrate"/"No seeders to run").
- **Testing**: `HttpTest.actingAs()`, persisting model factories (`factory(def, Model)`
  → `.create()/.createMany()`), and real `DatabaseTest.assertHas/assertMissing/assertCount`
  + transaction-based `refreshDatabase()`.
- **DI**: `enableAutoWiring()` opt-in for zero-config constructor injection (reflect-metadata).

### Storage

- Streaming multipart uploads on the local disk (`putStream`) — large files no longer
  buffered fully in memory.

## [1.7.0] - 2026-02-04

### Security Fixes

- **Mass Assignment**: Implemented `$fillable` and `$guarded` in `Model` to prevent unauthorized attribute assignment.
- **Path Traversal**: Hardened `Server.ts` static file serving to prevent directory traversal attacks.
- **JWT**: Added `kid` (Key ID) support to `Auth.ts` for key rotation in JWT signing and verification.

### Improvements

- **Offline Support**: Removed hardcoded Tailwind CDN from error pages; now uses inline styles.
- **CLI**: Enhanced flag parsing to support space-separated flags (e.g., `--name value`).
- **Session**: Added auto-cleanup interval to `MemorySessionDriver` to prevent memory leaks.
- **Router**: Secured `Router.url()` with `encodeURIComponent`.
- **Middleware**: Added `usePost()` for registering execution-after-handler middleware.

## [1.6.1] - 2026-02-01

### Added

- **Docs**: New Aspect-Oriented Programming (AOP) documentation covering Interceptors, Guards, and Pipes.
- **Mail**: Added `view()` method to `MailBuilder` for rendering email templates.

### Fixed

- **Router**: Added safety check for missing controller methods to prevent crash loops and provide clear error messages.
- **Docs**: Fixed unused imports and keys in documentation site.

## [1.6.0] - 2026-01-27

### Added

- **Native JSX Engine**: Complete removal of React dependency for lighter, faster SSR.
- **Global Helpers**: Added `route()` for named reverse routing.
- **Controller API**: Added `render()` helper for ease of view rendering.
- **CLI**: Enhanced Server Boot Message with vibrant colors.

### Fixed

- **Type Safety**: Resolved `RouterInstance` and `CanxRequest` type discrepancies.
- **Stability**: Fixed memory leaks in Session styling and legacy import issues.

## [1.5.0] - Previously Released

- **Microservices**: Added initial support for microservices architecture.
- **GraphQL**: Introduced modular GraphQL support.

## [1.4.0] - 2026-01-15

### Added

- **Scheduler**: Native cron-like task scheduling system.
  - Support for `schedule:run` command.
  - Fluent API for defining tasks (`scheduler.call()`, `scheduler.command()`).
- **AutoCache**: Intelligent request caching middleware.
  - Automatically caches slow, frequently accessed GET requests.
  - Configurable exclusion patterns and TTL.
- **CLI Commands**:
  - `schedule:run`: Execute scheduled tasks manually.
  - `optimize`: Optimize framework performance (clears caches).
- **Authentication Improvements**:
  - Added comprehensive unit tests for Auth, JWT, and Sessions.
  - Verified Argon2id password hashing and session drivers.

### Improvements

- Enhanced `DocsSidebar` with new documentation links.
- Updated `package.json` exports structure.
- Improved error handling consistency across the framework.

### Fixed

- Fixed minor type definitions in `Scheduler` and `AutoCache`.
