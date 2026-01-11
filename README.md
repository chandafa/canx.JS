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

const users = await User.query()
  .where("active", "=", true)
  .orderBy("created_at", "desc")
  .limit(10)
  .get();
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

- [Getting Started](https://canxjs.dev/docs/getting-started)
- [Routing](https://canxjs.dev/docs/routing)
- [Controllers](https://canxjs.dev/docs/controllers)
- [Models & ORM](https://canxjs.dev/docs/orm)
- [Middleware](https://canxjs.dev/docs/middleware)
- [HotWire](https://canxjs.dev/docs/hotwire)

## License

MIT © CanxJS Team
