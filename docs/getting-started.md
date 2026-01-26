# Getting Started with CanXJS

CanXJS is an ultra-fast, async-first MVC framework for Bun. It brings the developer experience of Laravel/Rails to the modern JavaScript ecosystem.

## Prerequisites

- **Bun** (v1.0.0 or higher)

## Installation

Create a new project using the interactive scaffolding tool:

```bash
# Create a new project
bun create canx-app my-app

# Navigate to directory
cd my-app

# Start the development server
bun run dev
```

## Directory Structure

```
my-app/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # MVC Controllers
│   ├── core/            # App bootstrapping (Kernel)
│   ├── database/        # Migrations & Seeds
│   ├── models/          # Data Models
│   ├── views/           # JSX Views (Server Rendered)
│   └── index.ts         # Entry point
├── .env                 # Environment variables
└── package.json
```

## Core Concepts

### 1. Routing & Controllers

Define routes in `src/routes/web.ts` or using Controller attributes:

```typescript
// src/controllers/UserController.ts
import { Controller, Get, View } from 'canx';

@Controller('/users')
export class UserController {
  @Get('/')
  index() {
    return <UserList users={...} />;
  }
}
```

### 2. Views (JSX)

Views are **Server-Side Rendered** (SSR). No `useState` or `useEffect`. Use AlpineJS for interactivity.

```tsx
// src/views/UserList.tsx
export const UserList = ({ users }) => (
  <div class="p-4">
    <h1>Users</h1>
    <ul>
      {users.map((u) => (
        <li>{u.name}</li>
      ))}
    </ul>
  </div>
);
```

### 3. Database (ORM)

CanXJS includes a zero-config ORM supporting MySQL, PostgreSQL, and SQLite.

```typescript
// src/models/User.ts
import { Model } from "canx";

export class User extends Model {
  // Implicitly maps to 'users' table
}

// Usage
const users = await User.where("active", true).get();
```

## Next Steps

- [Routing Guide](./routing.md)
- [Database & Migrations](./database.md)
- [View Engine](./views.md)
