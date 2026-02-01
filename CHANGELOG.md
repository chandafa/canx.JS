# Changelog

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
