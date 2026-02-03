# CanxJS

<p align="center">
  <strong>🚀 Ultra-fast async-first MVC backend framework for Bun</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/canxjs"><img src="https://img.shields.io/npm/v/canxjs.svg?style=flat-square" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/canxjs"><img src="https://img.shields.io/npm/dm/canxjs.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/user/canxjs/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/canxjs.svg?style=flat-square" alt="license"></a>
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#cli-commands">CLI</a> •
  <a href="#documentation">Documentation</a>
</p>

---

## Why CanxJS?

| Feature           | Express | Laravel | **CanxJS**   |
| ----------------- | ------- | ------- | ------------ |
| Requests/sec      | ~15,000 | ~2,000  | **250,000+** |
| Memory Usage      | ~80MB   | ~120MB  | **<30MB**    |
| Startup Time      | ~500ms  | ~2000ms | **<50ms**    |
| Native TypeScript | ❌      | ❌      | ✅           |
| Built-in ORM      | ❌      | ✅      | ✅           |

## Installation

```bash
# Create new project
bunx create-canx my-app
cd my-app
bun install
bun run dev
```

Or add to existing project:

```bash
bun add canxjs
```

## Quick Start

```typescript
import { createApp, logger, cors } from "canxjs";

const app = createApp({ port: 3000 });

app.use(logger());
app.use(cors());

app.get("/", (req, res) => res.json({ message: "Hello CanxJS!" }));

app.get("/users/:id", async (req, res) => {
  const user = await User.find(req.params.id);
  return res.json({ data: user });
});

app.listen();
```

## Features

### 🚀 Ultra-Fast Routing

Radix Tree algorithm with O(k) route matching and JIT caching.

### ⚡ Async-First Design

Everything is async by default. No callback hell.

### 🔥 HotWire Protocol

Real-time streaming without WebSocket setup.

```typescript
import { hotWire } from "canxjs";

app.get("/stream", (req, res) => hotWire.createStream(req, res));

// Broadcast to all clients
hotWire.broadcastHTML("updates", "<p>New data!</p>", "#content");
```

### 🧠 Auto-Cache Layer

Intelligent automatic caching with pattern analysis.

```typescript
import { autoCacheMiddleware } from "canxjs";

app.use(autoCacheMiddleware({ defaultTtl: 300 }));
```

### 🗄️ Zero-Config ORM

MySQL primary, PostgreSQL secondary support.

```typescript
import { Model, initDatabase } from "canxjs";

class User extends Model {
  static tableName = "users";
}

// Query with fluent API
const activeUsers = await User.query()
  .where("active", "=", true)
  .orderBy("created_at", "desc")
  .limit(10)
  .get();

// Eager Loading (N+1 Solution)
const users = await User.with("posts", "profile").get();
```

### 🔐 Built-in Authentication & Sessions

Secure session management with Database, File, or Redis drivers.

```typescript
import { auth, sessionAuth, DatabaseSessionDriver } from "canxjs";

// Use Database Driver for persistence
auth.sessions.use(new DatabaseSessionDriver());

app.post("/login", async (req, res) => {
  const session = await auth.sessions.create(user.id, { role: "admin" });
  return res.cookie("session_id", session.id).json({ status: "ok" });
});

app.get("/profile", sessionAuth, (req, res) => {
  return res.json({ user: req.context.get("user") });
});
```

### 🎨 Native JSX Views

```typescript
import { jsx, renderPage } from "canxjs";

app.get("/about", (req, res) => {
  return res.html(renderPage(jsx("h1", null, "About Us"), { title: "About" }));
});
```

### 🎯 Controller Decorators

```typescript
import { BaseController, Controller, Get, Post } from "canxjs";

@Controller("/users")
class UserController extends BaseController {
  @Get("/")
  async index() {
    return this.json(await User.all());
  }

  @Post("/")
  async store() {
    const data = await this.body();
    return this.json(await User.create(data), 201);
  }
}
```

## CLI Commands

CanxJS includes a powerful CLI for project management:

```bash
# Project scaffolding
bunx create-canx my-app           # Create MVC project
bunx create-canx my-api --api     # Create API-only project
bunx create-canx my-svc --micro   # Create microservice

# Development (inside project)
bunx canx serve                     # Start dev server with hot reload
bunx canx build                     # Build for production
bunx canx routes                    # List all registered routes

# Generators
bunx canx make:controller User         # Generate controller
bunx canx make:model Post --migration  # Generate model with migration
bunx canx make:middleware Auth         # Generate middleware
bunx canx make:migration create_posts  # Generate migration
bunx canx make:seeder User             # Generate seeder
bunx canx make:service Payment         # Generate service

# Database
bunx canx db:migrate                   # Run migrations
bunx canx db:rollback                  # Rollback migrations
bunx canx db:seed                      # Run seeders
bunx canx db:fresh                     # Drop all & re-migrate
```

## Project Structure

```
my-app/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── views/
│   ├── routes/
│   ├── middlewares/
│   ├── config/
│   └── app.ts
├── public/
├── storage/
└── package.json
```

## Documentation

- [Getting Started](http://docs-canxjs.netlify.app/docs/installation)
- [Routing](http://docs-canxjs.netlify.app/docs/routing)
- [Controllers](http://docs-canxjs.netlify.app/docs/controllers)
- [Models & ORM](http://docs-canxjs.netlify.app/docs/orm)
- [Middleware](http://docs-canxjs.netlify.app/docs/middleware)
- [HotWire](http://docs-canxjs.netlify.app/docs/hotwire)

## Optional Dependencies

CanxJS is designed to be lightweight. Some features require additional packages:

| Feature     | Required Package      | Install Command      |
| ----------- | --------------------- | -------------------- |
| PostgreSQL  | `pg`                  | `bun add pg`         |
| S3 Storage  | Built-in (uses fetch) | -                    |
| SMTP Email  | `nodemailer`          | `bun add nodemailer` |
| Redis Cache | `ioredis`             | `bun add ioredis`    |

## Official Packages

Extend CanxJS with official packages:

| Package                                                            | Description                                        | Install                    |
| ------------------------------------------------------------------ | -------------------------------------------------- | -------------------------- |
| [@canxjs/citadel](https://www.npmjs.com/package/@canxjs/citadel)   | API Token Authentication (like Laravel Sanctum)    | `bun add @canxjs/citadel`  |
| [@canxjs/dominion](https://www.npmjs.com/package/@canxjs/dominion) | Role-Based Access Control (like Spatie Permission) | `bun add @canxjs/dominion` |
| [@canxjs/blocks](https://www.npmjs.com/package/@canxjs/blocks)     | Modular Architecture (HMVC)                        | `bun add @canxjs/blocks`   |
| [@canxjs/payment](https://www.npmjs.com/package/@canxjs/payment)   | Midtrans Payment Gateway                           | `bun add @canxjs/payment`  |
| [@canxjs/echo](https://www.npmjs.com/package/@canxjs/echo)         | Real-time Event Broadcasting                       | `bun add @canxjs/echo`     |

## License

MIT © CanxJS Team
