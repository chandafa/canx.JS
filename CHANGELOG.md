# Changelog

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
