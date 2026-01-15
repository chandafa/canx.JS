
/**
 * CanxJS CLI - Project scaffolding tool
 * Usage: bunx create-canx my-app
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import prompts from 'prompts';
import pc from 'picocolors';

type ProjectType = 'api' | 'mvc' | 'microservice';
type Language = 'typescript' | 'javascript';
type Database = 'mysql' | 'postgres' | 'sqlite';

interface ProjectOptions {
  name: string;
  type: ProjectType;
  language: Language;
  database: Database;
  prisma: boolean;
}

// Helper to parse args
function parseArgs(args: string[]) {
  const flags: Record<string, string | boolean> = {};
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      const key = parts[0];
      const value = parts.length > 1 ? parts.slice(1).join('=') : true;
      flags[key] = value;
    }
  });
  return flags;
}

// Project files generators

function getPackageJson(options: ProjectOptions) {
  const deps: Record<string, string> = {
    'canxjs': 'latest',
  };

  if (options.type === 'mvc') {
     deps['canx-ui'] = 'latest';
  }
  
  const devDeps: Record<string, string> = {
    '@types/bun': 'latest',
    'concurrently': '^8.0.0',
  };

  if (options.type === 'mvc') {
    Object.assign(devDeps, {
      'tailwindcss': '^3.4.0',
      'postcss': '^8.4.0',
      'autoprefixer': '^10.4.0',
      'clsx': '^2.0.0',
      'tailwind-merge': '^2.0.0',
    });
  }

  if (options.language === 'typescript') {
    devDeps['typescript'] = '^5.3.0';
  }

  if (options.prisma) {
    deps['@prisma/client'] = 'latest';
    devDeps['prisma'] = 'latest';
  }

  const scripts: Record<string, string> = {
    "dev:server": `bun --watch src/app.${options.language === 'typescript' ? 'ts' : 'js'}`,
    "build:server": `bun build src/app.${options.language === 'typescript' ? 'ts' : 'js'} --outdir dist --target bun`,
    "test": 'bun test',
  };

  if (options.type === 'mvc') {
    scripts["dev:css"] = "bunx tailwindcss -i ./src/index.css -o ./public/css/app.css --watch";
    scripts["dev"] = "concurrently \"bun run dev:server\" \"bun run dev:css\"";
    scripts["build:css"] = "bunx tailwindcss -i ./src/index.css -o ./public/css/app.css --minify";
    scripts["build"] = "bun run build:server && bun run build:css";
  } else {
    scripts["dev"] = "bun run dev:server";
    scripts["build"] = "bun run build:server";
  }

  if (options.prisma) {
    scripts["db:migrate"] = "prisma migrate dev";
    scripts["db:studio"] = "prisma studio";
  }

  return JSON.stringify({
    name: options.name,
    version: '1.0.0',
    type: 'module',
    scripts,
    dependencies: deps,
    devDependencies: devDeps,
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
      allowJs: true,
    },
    include: ['src/**/*'],
  }, null, 2);
}

function getBunfig() {
  return `[run]
watch = ["src/**/*.ts", "src/**/*.tsx", "src/**/*.js", "src/**/*.jsx"]
`;
}

function getAppContent(options: ProjectOptions) {
  const isTs = options.language === 'typescript';
  
  if (options.type === 'microservice') {
    return `import { createApp } from 'canxjs';

const app = createApp({ 
  port: Number(process.env.PORT) || 3000,
  name: '${options.name}'
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: '${options.name}' }));
app.get('/', (req, res) => res.json({ message: 'Microservice is running' }));

app.listen(() => console.log('🚀 Microservice running on port ' + (process.env.PORT || 3000)));
`;
  }

  // MVC or API settings
  const imports = [
    `import { createApp, logger, cors${options.type === 'mvc' ? ', serveStatic' : ''} } from 'canxjs';`,
    `import { initDatabase } from 'canxjs';`,
    options.type === 'mvc' ? `import { webRoutes } from './routes/web';` : '',
    `import { apiRoutes } from './routes/api';`,
    `import dbConfig from './config/database';`,
  ].filter(Boolean);

  return `${imports.join('\n')}

const app = createApp({
  port: Number(process.env.PORT) || 3000,
  development: process.env.NODE_ENV !== 'production',
  cors: true,
});

// Middlewares
app.use(logger());
app.use(cors());
${options.type === 'mvc' ? 'app.use(serveStatic("public"));' : ''}

// Routes
${options.type === 'mvc' ? 'app.routes(webRoutes);' : ''}
app.routes(apiRoutes);

// Initialize database and start server
async function bootstrap() {
  try {
    await initDatabase(dbConfig);
    await app.listen(() => console.log('🚀 Server ready at http://localhost:' + (process.env.PORT || 3000)));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
`;
}

function getWebRoutes(options: ProjectOptions) {
  const isTs = options.language === 'typescript';
  const typeImport = isTs ? "import type { RouterInstance } from 'canxjs';" : "";
  const typeAnnot = isTs ? ": RouterInstance" : "";

  return `${typeImport}
import { HomeController } from '../controllers/HomeController';

export function webRoutes(router${typeAnnot}) {
  const home = new HomeController();
  
  router.get('/', (req, res) => home.index(req, res));
  router.get('/about', (req, res) => home.about(req, res));
}
`;
}

function getApiRoutes(options: ProjectOptions) {
  const isTs = options.language === 'typescript';
  const typeImport = isTs ? "import type { RouterInstance } from 'canxjs';" : "";
  const typeAnnot = isTs ? ": RouterInstance" : "";

  return `${typeImport}
import { UserController } from '../controllers/UserController';

export function apiRoutes(router${typeAnnot}) {
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

function getHomeController(options: ProjectOptions) {
  const isTs = options.language === 'typescript';
  const ext = isTs ? 'tsx' : 'jsx';
  const typeImports = isTs ? "import type { CanxRequest, CanxResponse } from 'canxjs';" : "";
  const reqType = isTs ? ": CanxRequest" : "";
  const resType = isTs ? ": CanxResponse" : "";

  return `import { BaseController, Controller, Get, renderPage } from 'canxjs';
import { Welcome } from '../views/Welcome';
${typeImports}

@Controller('/')
export class HomeController extends BaseController {
  @Get('/')
  index(req${reqType}, res${resType}) {
    const html = renderPage(Welcome({ version: '1.0.0' }), { 
      title: 'Welcome - CanxJS',
      cssPath: '/css/app.css'
    });
    return res.html(html);
  }

  @Get('/about')
  about(req${reqType}, res${resType}) {
    const html = renderPage(Welcome({ version: '1.0.0' }), { 
      title: 'About - CanxJS',
      cssPath: '/css/app.css'
    });
    return res.html(html);
  }
}
`;
}

function getUserController(options: ProjectOptions) {
  const isTs = options.language === 'typescript';
  const typeImports = isTs ? "import type { CanxRequest, CanxResponse } from 'canxjs';" : "";
  const reqType = isTs ? ": CanxRequest" : "";
  const resType = isTs ? ": CanxResponse" : "";

  return `${typeImports}
import { User } from '../models/User';
import { validate } from 'canxjs';

export class UserController {
  static async index(req${reqType}, res${resType}) {
    const users = await User.all();
    return res.json({ data: users });
  }

  static async show(req${reqType}, res${resType}) {
    const user = await User.find(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ data: user });
  }

  static async store(req${reqType}, res${resType}) {
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

  static async update(req${reqType}, res${resType}) {
    const body = await req.json();
    const updated = await User.updateById(req.params.id, body);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    return res.json({ message: 'User updated' });
  }

  static async destroy(req${reqType}, res${resType}) {
    const deleted = await User.deleteById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    return res.status(204).empty();
  }
}
`;
}

function getUserModel(options: ProjectOptions) {
  const isTs = options.language === 'typescript';
  
  if (isTs) {
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
  } else {
    // JS Version
    return `import { Model } from 'canxjs';

export class User extends Model {
  static tableName = 'users';
  static primaryKey = 'id';
  static timestamps = true;

  static async findByEmail(email) {
    return this.query().where('email', '=', email).first();
  }
}
`;
  }
}

function getDatabaseConfig(options: ProjectOptions) {
  const isTs = options.language === 'typescript';
  const typeExport = isTs ? "import type { DatabaseConfig } from 'canxjs';" : "";
  const typeAnnot = isTs ? ": DatabaseConfig" : "";
  
  let driver = 'mysql'; // default
  if (options.database === 'postgres') driver = 'postgres';
  if (options.database === 'sqlite') driver = 'sqlite';

  return `${typeExport}

const config${typeAnnot} = {
  driver: '${driver}',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || ${driver === 'postgres' ? 5432 : 3306},
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

function getEnvExample(options: ProjectOptions) {
  const port = options.database === 'postgres' ? 5432 : 3306;
  return `NODE_ENV=development
PORT=3000
APP_KEY=your-secret-key

DB_HOST=localhost
DB_PORT=${port}
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
`;
}

function getPrismaSchema(options: ProjectOptions) {
  let provider = 'mysql';
  if (options.database === 'postgres') provider = 'postgresql';
  if (options.database === 'sqlite') provider = 'sqlite';

  return `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
}

function getAppCss() {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

/* CanxJS Custom Styles */
:root {
  --canx-primary: #10b981;
  --canx-secondary: #06b6d4;
  --canx-dark: #0f172a;
}

/* Glass Effect */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Gradient Text */
.text-gradient {
  background: linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Aurora Background Animation */
.aurora-blob-1 { animation: aurora1 8s ease-in-out infinite; }
.aurora-blob-2 { animation: aurora2 10s ease-in-out infinite; }
.aurora-blob-3 { animation: aurora3 12s ease-in-out infinite; }

@keyframes aurora1 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.2; }
  50% { transform: translate(50px, 50px) scale(1.1); opacity: 0.3; }
}

@keyframes aurora2 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.2; }
  50% { transform: translate(-30px, 30px) scale(1.2); opacity: 0.25; }
}

@keyframes aurora3 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.1; }
  50% { transform: translate(40px, -40px) scale(1.15); opacity: 0.15; }
}

/* Grid Pattern */
.grid-pattern {
  background-image: 
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 50px 50px;
}

/* Animations */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fade-in-down {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes border-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.1); }
  50% { box-shadow: 0 0 30px rgba(16, 185, 129, 0.2); }
}

.animate-fade-in-up { animation: fade-in-up 0.6s ease-out; }
.animate-fade-in-down { animation: fade-in-down 0.6s ease-out; }
.animate-border-glow { animation: border-glow 3s ease-in-out infinite; }

/* Shimmer Button */
.shimmer-btn {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
}

.shimmer-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

/* Spotlight Card */
.spotlight-card {
  position: relative;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
  transition: all 0.3s ease;
}

.spotlight-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(16, 185, 129, 0.3);
  transform: translateY(-4px);
}
`;
}

function getTailwindConfig() {
  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx,js,jsx}',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        'canx-primary': '#10b981',
        'canx-secondary': '#06b6d4',
      },
    },
  },
  plugins: [],
}
`;
}

function getPostcssConfig() {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
}

function getAdminLayout() {
  return `import { jsx } from 'canxjs';

interface LayoutProps {
  title?: string;
  children?: any;
}

export function AdminLayout({ title = 'Admin', children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} - CanxJS Admin</title>
        <link rel="stylesheet" href="/css/app.css" />
      </head>
      <body class="bg-slate-950 text-white min-h-screen">
        <div class="flex">
          {/* Sidebar */}
          <aside class="w-64 min-h-screen bg-slate-900 border-r border-slate-800 p-4">
            <div class="text-xl font-bold text-gradient mb-8">CanxJS Admin</div>
            <nav class="space-y-2">
              <a href="/admin" class="block px-4 py-2 rounded-lg hover:bg-slate-800 transition">Dashboard</a>
              <a href="/admin/users" class="block px-4 py-2 rounded-lg hover:bg-slate-800 transition">Users</a>
              <a href="/admin/settings" class="block px-4 py-2 rounded-lg hover:bg-slate-800 transition">Settings</a>
            </nav>
          </aside>
          {/* Main Content */}
          <main class="flex-1 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
`;
}

function getWelcomeView(options: ProjectOptions) {
  return `import { jsx } from 'canxjs';

interface WelcomeProps {
  version?: string;
}

export function Welcome({ version = '1.0.0' }: WelcomeProps) {
  return (
    <>
      <head>
        <title>Welcome - CanxJS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/css/app.css" />
      </head>
      <div class="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white min-h-screen relative overflow-hidden">
        {/* Aurora Background */}
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute top-0 -left-40 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[100px] aurora-blob-1"></div>
          <div class="absolute top-20 -right-40 w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-[100px] aurora-blob-2"></div>
          <div class="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] aurora-blob-3"></div>
        </div>
        
        {/* Grid Pattern */}
        <div class="absolute inset-0 grid-pattern pointer-events-none opacity-50"></div>

        <div class="relative min-h-screen flex flex-col items-center justify-center px-4">
          <div class="w-full max-w-4xl text-center">
            {/* Header */}
            <header class="mb-12 animate-fade-in-down">
              <div class="flex items-center justify-center gap-3 mb-8">
                <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center text-2xl font-bold">C</div>
                <span class="text-2xl font-bold text-gradient">CanxJS</span>
              </div>
            </header>

            {/* Hero Section */}
            <main class="animate-fade-in-up">
              <div class="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-emerald-400 text-sm font-medium mb-8 animate-border-glow">
                <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                Version {version}
              </div>
              
              <h1 class="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
                <span class="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Welcome to
                </span>
                <br />
                <span class="text-gradient">CanxJS Framework</span>
              </h1>
              
              <p class="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
                Ultra-fast async-first MVC backend framework for Bun runtime.
                Build scalable applications with modern architecture.
              </p>

              {/* Quick Start */}
              <div class="glass rounded-xl px-6 py-4 inline-flex items-center gap-4 mb-12 animate-border-glow">
                <code class="text-emerald-400 font-mono text-lg">bunx create-canx my-app</code>
              </div>

              {/* Features */}
              <div class="grid gap-4 md:grid-cols-3 mt-12">
                <div class="spotlight-card p-6 text-left">
                  <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                  </div>
                  <h3 class="text-lg font-bold text-white mb-2">Blazing Fast</h3>
                  <p class="text-slate-400 text-sm">Ultra-fast routing with native Bun performance.</p>
                </div>
                <div class="spotlight-card p-6 text-left">
                  <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                    </svg>
                  </div>
                  <h3 class="text-lg font-bold text-white mb-2">Native JSX</h3>
                  <p class="text-slate-400 text-sm">Server-side JSX without React overhead.</p>
                </div>
                <div class="spotlight-card p-6 text-left">
                  <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                    </svg>
                  </div>
                  <h3 class="text-lg font-bold text-white mb-2">Built-in Auth</h3>
                  <p class="text-slate-400 text-sm">Secure authentication out of the box.</p>
                </div>
              </div>
            </main>

            {/* Footer */}
            <footer class="mt-16 py-8 border-t border-slate-800/50">
              <p class="text-slate-500 text-sm">
                CanxJS v{version} • Built with ❤️ for developers
              </p>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}
`;
}


// MAIN FUNCTION
async function main() {
  const args = process.argv.slice(2);
  let projectName = args.find(arg => !arg.startsWith('-'));
  const flags = parseArgs(args);

  // Handle help
  if (flags.help || flags.h) {
    console.log(`
CanxJS CLI - Project Scaffolding

Usage:
  bunx create-canx <project-name> [options]

Options:
  --type <type>        Project type (mvc, api, microservice)
  --language <lang>    Language (typescript, javascript)
  --database <db>      Database (mysql, postgres, sqlite)
  --prisma             Use Prisma ORM (default: false)
  --no-prisma          Disable Prisma ORM
  --help, -h           Show this help message

Examples:
  bunx create-canx my-app
  bunx create-canx my-api --type=api
  bunx create-canx my-service --type=microservice --language=javascript
`);
    process.exit(0);
  }

  // PROMPT 1: Project Name (if not provided)
  if (!projectName) {
    const response = await prompts({
      type: 'text',
      name: 'projectName',
      message: 'What is the name of your project?',
      initial: 'my-app'
    });
    projectName = response.projectName;
  }
  
  if (!projectName) {
     console.log(pc.red('❌ Operation cancelled'));
     process.exit(1);
  }

  // Define questions
  const questions: prompts.PromptObject[] = [];

  if (!flags.type) {
    questions.push({
      type: 'select',
      name: 'type',
      message: 'Mau membuat project apa?', 
      choices: [
        { title: 'Fullstack (MVC)', value: 'mvc', description: 'Full application with views' },
        { title: 'API Only', value: 'api', description: 'REST API without views' },
        { title: 'Microservice', value: 'microservice', description: 'Minimal microservice' }
      ],
      initial: 0
    });
  }

  if (!flags.language) {
    questions.push({
      type: 'select',
      name: 'language',
      message: 'Mau menggunakan bahasa apa?',
      choices: [
        { title: 'TypeScript', value: 'typescript', description: 'Strongly typed (Recommended)' },
        { title: 'JavaScript', value: 'javascript', description: 'Standard JavaScript' }
      ],
      initial: 0
    });
  }

  if (!flags.database) {
    questions.push({
      type: 'select',
      name: 'database',
      message: 'Mau menggunakan database apa?',
      choices: [
        { title: 'MySQL', value: 'mysql' },
        { title: 'PostgreSQL', value: 'postgres' },
        { title: 'SQLite', value: 'sqlite' }
      ],
      initial: 0
    });
  }

  if (flags.prisma === undefined && !flags['no-prisma']) {
    questions.push({
      type: 'select',
      name: 'prisma',
      message: 'Mau otomatis menggunakan tools prisma atau tidak?',
      choices: [
        { title: 'Yes', value: true },
        { title: 'No', value: false }
      ],
      initial: 0
    });
  }

  const answers = questions.length > 0 ? await prompts(questions, {
    onCancel: () => {
      console.log(pc.red('❌ Operation cancelled'));
      process.exit(1);
    }
  }) : {};

  // Default values
  const defaultOptions: ProjectOptions = {
    name: projectName!,
    type: 'mvc',
    language: 'typescript',
    database: 'mysql',
    prisma: false
  };

  const finalOptions: ProjectOptions = {
    name: projectName!,
    type: (flags.type as ProjectType) || answers.type || defaultOptions.type,
    language: (flags.language as Language) || answers.language || defaultOptions.language,
    database: (flags.database as Database) || answers.database || defaultOptions.database,
    prisma: flags.prisma === true || flags.prisma === 'true' || answers.prisma === true || false
  };

  createProject(finalOptions);
}

// Create project
function createProject(options: ProjectOptions) {
  const projectPath = resolve(process.cwd(), options.name);

  if (existsSync(projectPath)) {
    console.error(pc.red(`❌ Directory "${options.name}" already exists!`));
    process.exit(1);
  }

  console.log(pc.green(`\n🚀 Creating CanxJS project: ${options.name}\n`));
  console.log(pc.dim(`   Type: ${options.type}`));
  console.log(pc.dim(`   Language: ${options.language}`));
  console.log(pc.dim(`   Database: ${options.database}`));
  
  // Create directories based on project type
  let dirs: string[];
  if (options.type === 'microservice') {
    dirs = ['src'];
  } else if (options.type === 'api') {
    // API-only: no views, no public CSS
    dirs = ['src', 'src/controllers', 'src/models', 'src/routes', 'src/middlewares', 'src/config', 'public'];
  } else {
    // MVC: full project with views
    dirs = ['src', 'src/controllers', 'src/models', 'src/views', 'src/resources/views/layouts', 'src/routes', 'src/middlewares', 'src/config', 'public', 'public/css', 'storage'];
  }

  if (options.prisma) {
    dirs.push('prisma');
  }

  dirs.forEach(dir => {
    mkdirSync(join(projectPath, dir), { recursive: true });
  });

  // Create files
  const ext = options.language === 'typescript' ? 'ts' : 'js';
  
  const files: [string, string][] = [
    ['package.json', getPackageJson(options)],
    ['bunfig.toml', getBunfig()],
    ['.gitignore', getGitignore()],
    ['.env.example', getEnvExample(options)],
    ['README.md', getReadme(options.name)],
    [`src/app.${ext}`, getAppContent(options)],
  ];

  if (options.language === 'typescript') {
    files.push(['tsconfig.json', getTsConfig()]);
  }

  if (options.prisma) {
    files.push(['prisma/schema.prisma', getPrismaSchema(options)]);
  }

  if (options.type !== 'microservice') {
    const viewExt = options.language === 'typescript' ? 'tsx' : 'jsx';
    
    // Common files for both MVC and API
    files.push(
      [`src/routes/api.${ext}`, getApiRoutes(options)],
      [`src/controllers/UserController.${ext}`, getUserController(options)],
      [`src/models/User.${ext}`, getUserModel(options)],
      [`src/config/database.${ext}`, getDatabaseConfig(options)],
      [`src/config/app.${ext}`, getAppConfig()],
    );
    
    // MVC-specific files (includes views, layouts, CSS, web routes)
    if (options.type === 'mvc') {
      files.push(
        [`src/routes/web.${ext}`, getWebRoutes(options)],
        [`src/controllers/HomeController.${ext}`, getHomeController(options)],
        [`src/index.css`, getAppCss()],
        [`tailwind.config.js`, getTailwindConfig()],
        [`postcss.config.js`, getPostcssConfig()],
        [`src/views/Welcome.${viewExt}`, getWelcomeView(options)],
        [`src/resources/views/layouts/admin.${viewExt}`, getAdminLayout()],
      );
    }
  }

  files.forEach(([file, content]) => {
    writeFileSync(join(projectPath, file), content.trim() + '\n');
    console.log(pc.blue(`  📄 Created ${file}`));
  });

  console.log(pc.green(`\n✅ Project created successfully!`));
  console.log(`\nNext steps:\n`);
  console.log(pc.cyan(`  cd ${options.name}`));
  console.log(pc.cyan(`  bun install`));
  if (options.prisma) {
    console.log(pc.cyan(`  bun run db:migrate`));
  }
  console.log(pc.cyan(`  bun run dev`));
  console.log(`\n🌐 Server will start at http://localhost:3000\n`);
}

// Run main
main().catch(console.error);
