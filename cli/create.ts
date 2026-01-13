#!/usr/bin/env bun
/**
 * CanxJS CLI - Project scaffolding tool
 * Usage: bunx create-canx my-app
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const TEMPLATES = {
  mvc: {
    name: 'MVC Application',
    description: 'Full MVC application with controllers, models, and views',
  },
  api: {
    name: 'API Only',
    description: 'REST API without views',
  },
  microservice: {
    name: 'Microservice',
    description: 'Minimal microservice structure',
  },
};

// Project files
function getPackageJson(name: string, template: string) {
  return JSON.stringify({
    name,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'bun --watch src/app.ts',
      start: 'bun src/app.ts',
      build: 'bun build src/app.ts --outdir dist --target bun',
      test: 'bun test',
    },
    dependencies: {
      canxjs: '^1.2.0',
    },
    devDependencies: {
      '@types/bun': 'latest',
      typescript: '^5.3.0',
    },
  }, null, 2);
}

function getTsConfig() {
  return JSON.stringify({
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ESNext'],
      types: ['bun-types'],
      jsx: 'react-jsx',
      jsxImportSource: 'canxjs',
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      baseUrl: '.',
      paths: { '@/*': ['./src/*'] },
    },
    include: ['src/**/*'],
  }, null, 2);
}

function getBunfig() {
  return `[run]
watch = ["src/**/*.ts", "src/**/*.tsx"]
`;
}

function getAppTs(template: string) {
  if (template === 'microservice') {
    return `import { createApp } from 'canxjs';

const app = createApp({ port: 3000 });

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/data', (req, res) => res.json({ message: 'Hello from microservice!' }));

app.listen();
`;
  }

  return `import { createApp, logger, cors } from 'canxjs';
import { initDatabase } from 'canxjs';
import { webRoutes } from './routes/web';
import { apiRoutes } from './routes/api';
import dbConfig from './config/database';

const app = createApp({
  port: 3000,
  development: true,
  cors: true,
});

// Middlewares
app.use(logger());
app.use(cors());

// Routes
app.routes(webRoutes);
app.routes(apiRoutes);

// Initialize database and start server
async function bootstrap() {
  await initDatabase(dbConfig);
  await app.listen(() => console.log('🚀 Server ready!'));
}

bootstrap().catch(console.error);
`;
}

function getWebRoutes() {
  return `import type { RouterInstance } from 'canxjs';
import { HomeController } from '../controllers/HomeController';

export function webRoutes(router: RouterInstance) {
  // Traditional route definition
  // router.get('/', (req, res) => home.index(req, res));
  
  // New Controller-based routing (v1.2.0+)
  router.controller('/', HomeController);
}
`;
}

function getApiRoutes() {
  return `import type { RouterInstance } from 'canxjs';
import { UserController } from '../controllers/UserController';

export function apiRoutes(router: RouterInstance) {
  router.group('/api', (api) => {
    api.group('/users', (users) => {
      users.get('/', UserController.index);
      users.get('/:id', UserController.show);
      users.post('/', UserController.store);
      users.put('/:id', UserController.update);
      users.delete('/:id', UserController.destroy);
    });
  });
}
`;
}

function getHomeController() {
  return `import { BaseController, Controller, Get } from 'canxjs';
import { renderPage, jsx } from 'canxjs';
import type { CanxRequest, CanxResponse } from 'canxjs';

@Controller('/')
export class HomeController extends BaseController {
  @Get('/')
  index(req: CanxRequest, res: CanxResponse) {
    const html = renderPage(
      jsx('div', { className: 'container mx-auto px-4 py-8' },
        jsx('h1', { className: 'text-4xl font-bold mb-4' }, 'Welcome to CanxJS!'),
        jsx('p', { className: 'text-lg mb-4' }, 'Ultra-fast async-first MVC framework for Bun'),
        jsx('div', { className: 'flex gap-4' },
          jsx('a', { href: '/about', className: 'text-blue-500 hover:underline' }, 'About'),
          jsx('a', { href: '/canx-queue', className: 'text-blue-500 hover:underline' }, 'Queue Dashboard')
        )
      ),
      { title: 'Home - CanxJS' }
    );
    return res.html(html);
  }

    return res.html(html);
  }
}
`;
}

function getUserController() {
  return `import type { CanxRequest, CanxResponse } from 'canxjs';
import { User } from '../models/User';
import { validate } from 'canxjs';

export class UserController {
  static async index(req: CanxRequest, res: CanxResponse) {
    const users = await User.all();
    return res.json({ data: users });
  }

  static async show(req: CanxRequest, res: CanxResponse) {
    const user = await User.find(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ data: user });
  }

  static async store(req: CanxRequest, res: CanxResponse) {
    const body = await req.json();
    const { valid, errors, data } = validate(body, {
      name: ['required', 'string', 'min:2'],
      email: ['required', 'email'],
      password: ['required', 'min:8'],
    });

    if (!valid) return res.status(422).json({ errors: Object.fromEntries(errors) });
    
    const user = await User.create(data);
    return res.status(201).json({ data: user });
  }

  static async update(req: CanxRequest, res: CanxResponse) {
    const body = await req.json();
    const updated = await User.updateById(req.params.id, body);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    return res.json({ message: 'User updated' });
  }

  static async destroy(req: CanxRequest, res: CanxResponse) {
    const deleted = await User.deleteById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    return res.status(204).empty();
  }
}
`;
}

function getUserModel() {
  return `import { Model } from 'canxjs';

interface UserType {
  id: number;
  name: string;
  email: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export class User extends Model<UserType> {
  protected static tableName = 'users';
  protected static primaryKey = 'id';
  protected static timestamps = true;

  static async findByEmail(email: string): Promise<UserType | null> {
    return this.query<UserType>().where('email', '=', email).first();
  }
}
`;
}

function getDatabaseConfig() {
  return `import type { DatabaseConfig } from 'canxjs';

const config: DatabaseConfig = {
  driver: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'canxjs_app',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  logging: process.env.NODE_ENV !== 'production',
  pool: { min: 2, max: 10 },
};

export default config;
`;
}

function getAppConfig() {
  return `export default {
  name: 'CanxJS App',
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  key: process.env.APP_KEY || 'your-secret-key',
};
`;
}

function getEnvExample() {
  return `NODE_ENV=development
PORT=3000
APP_KEY=your-secret-key

DB_HOST=localhost
DB_PORT=3306
DB_NAME=canxjs_app
DB_USER=root
DB_PASS=
`;
}

function getGitignore() {
  return `node_modules/
dist/
.env
*.log
.DS_Store
`;
}

function getReadme(name: string) {
  return `# ${name}

Built with [CanxJS](http://docs-canxjs.netlify.app) - Ultra-fast async-first MVC framework for Bun

## Getting Started

\`\`\`bash
bun install
bun run dev
\`\`\`

## Available Scripts

- \`bun run dev\` - Start development server with hot reload
- \`bun run start\` - Start production server
- \`bun run build\` - Build for production
- \`bun run test\` - Run tests

## Project Structure

\`\`\`
src/
├── controllers/    # Request handlers
├── models/         # Database models
├── views/          # JSX views
├── routes/         # Route definitions
├── middlewares/    # Custom middlewares
├── config/         # Configuration files
└── app.ts          # Application entry
\`\`\`
`;
}

// Create project
function createProject(projectName: string, template: string = 'mvc') {
  const projectPath = resolve(process.cwd(), projectName);

  if (existsSync(projectPath)) {
    console.error(`❌ Directory "${projectName}" already exists!`);
    process.exit(1);
  }

  console.log(`\n🚀 Creating CanxJS project: ${projectName}\n`);

  // Create directories
  const dirs = template === 'microservice' 
    ? ['src']
    : ['src', 'src/controllers', 'src/models', 'src/views', 'src/routes', 'src/middlewares', 'src/config', 'public', 'storage'];

  dirs.forEach(dir => {
    mkdirSync(join(projectPath, dir), { recursive: true });
    console.log(`  📁 Created ${dir}/`);
  });

  // Create files
  const files: [string, string][] = [
    ['package.json', getPackageJson(projectName, template)],
    ['tsconfig.json', getTsConfig()],
    ['bunfig.toml', getBunfig()],
    ['.gitignore', getGitignore()],
    ['.env.example', getEnvExample()],
    ['README.md', getReadme(projectName)],
    ['src/app.ts', getAppTs(template)],
  ];

  if (template !== 'microservice') {
    files.push(
      ['src/routes/web.ts', getWebRoutes()],
      ['src/routes/api.ts', getApiRoutes()],
      ['src/controllers/HomeController.ts', getHomeController()],
      ['src/controllers/UserController.ts', getUserController()],
      ['src/models/User.ts', getUserModel()],
      ['src/config/database.ts', getDatabaseConfig()],
      ['src/config/app.ts', getAppConfig()],
    );
  }

  files.forEach(([file, content]) => {
    writeFileSync(join(projectPath, file), content);
    console.log(`  📄 Created ${file}`);
  });

  console.log(`
✅ Project created successfully!

Next steps:
  cd ${projectName}
  bun install
  bun run dev

🌐 Server will start at http://localhost:3000
`);
}

// CLI entry
if (import.meta.main) {
  const args = process.argv.slice(2);
  const projectName = args.find(arg => !arg.startsWith('-'));
  const template = args.includes('--api') ? 'api' : args.includes('--micro') ? 'microservice' : 'mvc';

  function showHelp() {
    console.log(`
CanxJS CLI - Project Scaffolding

Usage:
  bunx create-canx <project-name> [options]

Options:
  --api      Create API-only project
  --micro    Create microservice project
  --help     Show this help message

Examples:
  bunx create-canx my-app
  bunx create-canx my-api --api
  bunx create-canx my-service --micro
`);
  }

  if (args.includes('--help') || args.includes('-h') || !projectName) {
    showHelp();
    process.exit(0);
  }

  createProject(projectName, template);
}

export { createProject };
