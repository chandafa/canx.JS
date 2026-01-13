
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
    'canxjs': 'latest',
    'canx-ui': 'latest',
  };
  
  const devDeps: Record<string, string> = {
    '@types/bun': 'latest',
    'tailwindcss': '^3.4.0',
    'postcss': '^8.4.0',
    'autoprefixer': '^10.4.0',
    'clsx': '^2.0.0',
    'tailwind-merge': '^2.0.0',
    'concurrently': '^8.0.0',
  };

  if (options.language === 'typescript') {
    devDeps['typescript'] = '^5.3.0';
  }

  if (options.prisma) {
    deps['@prisma/client'] = 'latest';
    devDeps['prisma'] = 'latest';
  }

  return JSON.stringify({
    name: options.name,
    version: '1.0.0',
    type: 'module',
    scripts: {
      "dev:server": `bun --watch src/app.${options.language === 'typescript' ? 'ts' : 'js'}`,
      "dev:css": "bunx tailwindcss -i ./src/index.css -o ./public/css/app.css --watch",
      "dev": "concurrently \"bun run dev:server\" \"bun run dev:css\"",
      "build:server": `bun build src/app.${options.language === 'typescript' ? 'ts' : 'js'} --outdir dist --target bun`,
      "build:css": "bunx tailwindcss -i ./src/index.css -o ./public/css/app.css --minify",
      "build": "bun run build:server && bun run build:css",
      test: 'bun test',
      ...(options.prisma ? {
        "db:migrate": "prisma migrate dev",
        "db:studio": "prisma studio"
      } : {})
    },
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

const app = createApp({ port: 3000 });

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/data', (req, res) => res.json({ message: 'Hello from microservice!' }));

app.listen();
`;
  }

  // MVC or API
  const imports = [
    `import { createApp, logger, cors } from 'canxjs';`,
    `import { initDatabase } from 'canxjs';`,
    `import { webRoutes } from './routes/web';`,
    `import { apiRoutes } from './routes/api';`,
    `import dbConfig from './config/database';`,
  ];

  return `${imports.join('\n')}

const app = createApp({
  port: 3000,
  development: true,
  cors: true,
  // Add other config here
});

// Middlewares
app.use(logger());
app.use(cors());

// Routes
${options.type === 'mvc' ? 'app.routes(webRoutes);' : ''}
app.routes(apiRoutes);

// Initialize database and start server
async function bootstrap() {
  await initDatabase(dbConfig);
  await app.listen(() => console.log('🚀 Server ready!'));
}

bootstrap().catch(console.error);
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
  const typeImports = isTs ? "import type { CanxRequest, CanxResponse } from 'canxjs';" : "";
  const reqType = isTs ? ": CanxRequest" : "";
  const resType = isTs ? ": CanxResponse" : "";

  return `import { BaseController, Controller, Get } from 'canxjs';
import { renderPage, jsx } from 'canxjs';
${typeImports}

@Controller('/')
export class HomeController extends BaseController {
  @Get('/')
  index(req${reqType}, res${resType}) {
    const html = renderPage(
      jsx('div', { className: 'container' },
        jsx('h1', null, 'Welcome to CanxJS!'),
        jsx('p', null, 'Ultra-fast async-first MVC framework for Bun'),
        jsx('a', { href: '/about' }, 'About')
      ),
      { title: 'Home - CanxJS' }
    );
    return res.html(html);
  }

  @Get('/about')
  about(req${reqType}, res${resType}) {
    const html = renderPage(
      jsx('div', { className: 'container' },
        jsx('h1', null, 'About CanxJS'),
        jsx('ul', null,
          jsx('li', null, '🚀 Ultra-fast Bun runtime'),
          jsx('li', null, '⚡ Async-first design'),
          jsx('li', null, '🔥 HotWire real-time streaming'),
          jsx('li', null, '🧠 Auto-caching layer')
        ),
        jsx('a', { href: '/' }, 'Back to Home')
      ),
      { title: 'About - CanxJS' }
    );
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
  
  // Create directories
  const dirs = options.type === 'microservice' 
    ? ['src']
    : ['src', 'src/controllers', 'src/models', 'src/views', 'src/resources/views/layouts', 'src/routes', 'src/middlewares', 'src/config', 'public', 'storage'];

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
    files.push(
      [`src/routes/web.${ext}`, getWebRoutes(options)],
      [`src/routes/api.${ext}`, getApiRoutes(options)],
      [`src/controllers/HomeController.${ext}`, getHomeController(options)],
      [`src/controllers/UserController.${ext}`, getUserController(options)],
      [`src/models/User.${ext}`, getUserModel(options)],
      [`src/config/database.${ext}`, getDatabaseConfig(options)],
      [`src/config/app.${ext}`, getAppConfig()],
      [`src/config/database.${ext}`, getDatabaseConfig(options)],
      [`src/config/app.${ext}`, getAppConfig()],
      [`src/index.css`, getAppCss()],
      [`tailwind.config.js`, getTailwindConfig()],
      [`src/resources/views/layouts/admin.tsx`, getAdminLayout()],
    );
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
