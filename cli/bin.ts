#!/usr/bin/env bun
/**
 * CanxJS CLI Binary - Enhanced with generators and database commands
 * Usage: canx <command> [options]
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve, basename } from 'path';
import { spawnSync } from 'child_process';
import { createProject } from './create';

const VERSION = '1.0.0';

// ============================================
// Generator Templates
// ============================================

function getControllerTemplate(name: string, className: string) {
  return `import { BaseController, Controller, Get, Post, Put, Delete, Middleware, View } from 'canxjs';
import type { CanxRequest, CanxResponse } from 'canxjs';

@Controller('/${name.toLowerCase()}s')
export class ${className} extends BaseController {
  @Get('/')
  async index(req: CanxRequest, res: CanxResponse) {
    // List all ${name}s
    return res.json({ data: [] });
  }

  @Get('/:id')
  async show(req: CanxRequest, res: CanxResponse) {
    const { id } = req.params;
    // Get ${name} by ID
    return res.json({ data: { id } });
  }

  @Post('/')
  async store(req: CanxRequest, res: CanxResponse) {
    const body = await req.json();
    // Create new ${name}
    return res.status(201).json({ data: body });
  }

  @Put('/:id')
  async update(req: CanxRequest, res: CanxResponse) {
    const { id } = req.params;
    const body = await req.json();
    // Update ${name}
    return res.json({ data: { id, ...body } });
  }

  @Delete('/:id')
  async destroy(req: CanxRequest, res: CanxResponse) {
    const { id } = req.params;
    // Delete ${name}
    return res.status(204).empty();
  }
}
`;
}

function getModelTemplate(name: string, tableName: string) {
  return `import { Model } from 'canxjs';

interface ${name}Type {
  id: number;
  // Add your fields here
  created_at: string;
  updated_at: string;
}

export class ${name} extends Model<${name}Type> {
  protected static tableName = '${tableName}';
  protected static primaryKey = 'id';
  protected static timestamps = true;

  // Add custom methods here
  static async findActive(): Promise<${name}Type[]> {
    return this.query<${name}Type>()
      .where('active', '=', true)
      .get();
  }
}
`;
}

function getMiddlewareTemplate(name: string, className: string) {
  return `import type { MiddlewareHandler, CanxRequest, CanxResponse } from 'canxjs';

export function ${name}Middleware(): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse, next) => {
    // Add your middleware logic here
    console.log('[${className}] Processing request...');

    // Call next to continue the chain
    return next();
  };
}

export default ${name}Middleware;
`;
}

function getMigrationTemplate(name: string, tableName: string) {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `import { Schema, defineMigration } from 'canxjs';

export default defineMigration(
  '${timestamp}_${name}',
  
  // Up: Create the table
  async () => {
    await Schema.create('${tableName}', (table) => {
      table.id();
      // Add your columns here
      table.string('name');
      table.text('description').nullable();
      table.boolean('active').default(true);
      table.timestamps();
    });
  },

  // Down: Drop the table
  async () => {
    await Schema.drop('${tableName}');
  }
);
`;
}

function getSeederTemplate(name: string, modelName: string) {
  return `import { ${modelName} } from '../models/${modelName}';

export async function ${name}Seeder() {
  console.log('[Seeder] Seeding ${modelName}s...');

  const data = [
    // Add your seed data here
    { name: 'Sample 1' },
    { name: 'Sample 2' },
    { name: 'Sample 3' },
  ];

  for (const item of data) {
    await ${modelName}.create(item);
  }

  console.log('[Seeder] ${modelName}s seeded successfully!');
}

export default ${name}Seeder;
`;
}

function getServiceTemplate(name: string, className: string) {
  return `import { Injectable } from 'canxjs';

@Injectable()
export class ${className} {
  constructor() {
    // Inject dependencies here
  }

  async findAll(): Promise<unknown[]> {
    // Implement your service logic
    return [];
  }

  async findById(id: string | number): Promise<unknown | null> {
    // Find by ID
    return null;
  }

  async create(data: unknown): Promise<unknown> {
    // Create new record
    return data;
  }

  async update(id: string | number, data: unknown): Promise<unknown> {
    // Update record
    return { id, ...data as object };
  }

  async delete(id: string | number): Promise<boolean> {
    // Delete record
    return true;
  }
}

export default ${className};
`;
}

function getNotificationTemplate(name: string, className: string) {
  return `import { Notification, type Notifiable } from 'canxjs';
import type { MailMessage } from 'canxjs';

interface ${className}Data {
  // Define your notification data here
  title: string;
  message: string;
}

export class ${className} extends Notification<${className}Data> {
  via(notifiable: Notifiable) {
    return ['mail', 'database'] as const;
  }

  toMail(notifiable: Notifiable): MailMessage {
    return {
      to: [notifiable.email || ''],
      subject: this.data.title,
      html: \`
        <h1>\${this.data.title}</h1>
        <p>\${this.data.message}</p>
      \`,
    };
  }

  toDatabase(notifiable: Notifiable) {
    return {
      title: this.data.title,
      message: this.data.message,
      read: false,
    };
  }
}

export default ${className};
`;
}

// ============================================
// Helper Functions
// ============================================

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .replace(/^\w/, c => c.toUpperCase());
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function generateFile(type: string, name: string, options: string[] = []) {
  const srcDir = resolve(process.cwd(), 'src');
  let dir: string;
  let filename: string;
  let content: string;
  const className = toPascalCase(name);

  switch (type) {
    case 'controller':
      dir = join(srcDir, 'controllers');
      filename = `${className}Controller.ts`;
      content = getControllerTemplate(name, `${className}Controller`);
      break;

    case 'model':
      dir = join(srcDir, 'models');
      filename = `${className}.ts`;
      content = getModelTemplate(className, toSnakeCase(name) + 's');
      break;

    case 'middleware':
      dir = join(srcDir, 'middlewares');
      filename = `${className}Middleware.ts`;
      content = getMiddlewareTemplate(name, `${className}Middleware`);
      break;

    case 'migration':
      dir = join(srcDir, 'database', 'migrations');
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      filename = `${timestamp}_${toSnakeCase(name)}.ts`;
      content = getMigrationTemplate(toSnakeCase(name), toSnakeCase(name) + 's');
      break;

    case 'seeder':
      dir = join(srcDir, 'database', 'seeders');
      filename = `${className}Seeder.ts`;
      content = getSeederTemplate(className, className);
      break;

    case 'service':
      dir = join(srcDir, 'services');
      filename = `${className}Service.ts`;
      content = getServiceTemplate(name, `${className}Service`);
      break;

    case 'notification':
      dir = join(srcDir, 'notifications');
      filename = `${className}Notification.ts`;
      content = getNotificationTemplate(name, `${className}Notification`);
      break;

    default:
      console.error(`Unknown generator type: ${type}`);
      process.exit(1);
  }

  ensureDir(dir);
  const filepath = join(dir, filename);

  if (existsSync(filepath) && !options.includes('--force')) {
    console.error(`❌ File already exists: ${filepath}`);
    console.log('   Use --force to overwrite');
    process.exit(1);
  }

  writeFileSync(filepath, content);
  console.log(`✅ Created: ${filepath}`);

  // Generate model with migration
  if (type === 'model' && options.includes('--migration')) {
    generateFile('migration', `create_${toSnakeCase(name)}s_table`, options);
  }
}

// ============================================
// Commands
// ============================================

const commands: Record<string, { description: string; handler: (args: string[]) => void | Promise<void> }> = {
  new: {
    description: 'Create a new CanxJS project',
    handler: (args) => {
      const name = args[0];
      const template = args.includes('--api') ? 'api' : args.includes('--micro') ? 'microservice' : 'mvc';
      
      if (!name) {
        console.error('Usage: canx new <project-name> [options]');
        process.exit(1);
      }
      createProject(name, template);
    },
  },

  create: {
    description: 'Alias for "new"',
    handler: (args) => {
      const name = args[0];
      const template = args.includes('--api') ? 'api' : args.includes('--micro') ? 'microservice' : 'mvc';
      
      if (!name) {
        console.error('Usage: canx create <project-name> [options]');
        process.exit(1);
      }
      createProject(name, template);
    },
  },

  serve: {
    description: 'Start development server with hot reload',
    handler: () => {
      console.log('\n🚀 Starting development server...\n');
      spawnSync('bun', ['--watch', 'src/app.ts'], { stdio: 'inherit' });
    },
  },

  build: {
    description: 'Build for production',
    handler: () => {
      console.log('\n📦 Building for production...\n');
      spawnSync('bun', ['build', 'src/app.ts', '--outdir', 'dist', '--target', 'bun', '--minify'], { stdio: 'inherit' });
      console.log('\n✅ Build complete! Output in ./dist\n');
    },
  },

  routes: {
    description: 'List all registered routes',
    handler: async () => {
      try {
        const app = await import(process.cwd() + '/src/app.ts');
        const routes = app.default?.router?.getRoutes?.() || [];
        console.log('\n📍 Registered Routes:\n');
        routes.forEach((r: any) => console.log(`  ${r.method.padEnd(7)} ${r.path}`));
        console.log(`\nTotal: ${routes.length} routes\n`);
      } catch (e) {
        console.error('Could not load routes. Make sure src/app.ts exists and exports default app.');
      }
    },
  },

  'generate:client': {
    description: 'Generate Type-Safe Client SDK',
    handler: async (args) => {
      const output = args[0] || 'client.ts';
      console.log(`\n🔮 Generating Client SDK to ${output}...\n`);
      try {
        // We need to import the app to get the routes
        // This assumes src/app.ts exports the Canx app instance as default
        const appModule = await import(process.cwd() + '/src/app.ts');
        const app = appModule.default;
        
        if (!app) {
           throw new Error('src/app.ts must export the Canx app instance as default.');
        }

        // We import ClientGenerator dynamically to ensure we get the one from the project's canxjs version
        // Or if we are running from the CLI package itself, we might need a different strategy.
        // For now, let's try importing from the framework.
        const { ClientGenerator } = await import('canxjs');
        const generator = new ClientGenerator(app);
        generator.generate(output);

        console.log('\n✅ Client SDK generated successfully!\n');
      } catch (e) {
        console.error('Generation failed:', e);
        console.log('Tip: Ensure src/app.ts exports "default app"');
      }
    },
  },

  'make:controller': {
    description: 'Generate a new controller',
    handler: (args) => {
      const name = args[0];
      if (!name) {
        console.error('Usage: canx make:controller <name>');
        process.exit(1);
      }
      generateFile('controller', name, args.slice(1));
    },
  },

  'make:model': {
    description: 'Generate a new model (--migration to include migration)',
    handler: (args) => {
      const name = args[0];
      if (!name) {
        console.error('Usage: canx make:model <name> [--migration]');
        process.exit(1);
      }
      generateFile('model', name, args.slice(1));
    },
  },

  'make:middleware': {
    description: 'Generate a new middleware',
    handler: (args) => {
      const name = args[0];
      if (!name) {
        console.error('Usage: canx make:middleware <name>');
        process.exit(1);
      }
      generateFile('middleware', name, args.slice(1));
    },
  },

  'make:migration': {
    description: 'Generate a new migration',
    handler: (args) => {
      const name = args[0];
      if (!name) {
        console.error('Usage: canx make:migration <name>');
        process.exit(1);
      }
      generateFile('migration', name, args.slice(1));
    },
  },

  'make:seeder': {
    description: 'Generate a new seeder',
    handler: (args) => {
      const name = args[0];
      if (!name) {
        console.error('Usage: canx make:seeder <name>');
        process.exit(1);
      }
      generateFile('seeder', name, args.slice(1));
    },
  },

  'make:service': {
    description: 'Generate a new service',
    handler: (args) => {
      const name = args[0];
      if (!name) {
        console.error('Usage: canx make:service <name>');
        process.exit(1);
      }
      generateFile('service', name, args.slice(1));
    },
  },

  'make:notification': {
    description: 'Generate a new notification',
    handler: (args) => {
      const name = args[0];
      if (!name) {
        console.error('Usage: canx make:notification <name>');
        process.exit(1);
      }
      generateFile('notification', name, args.slice(1));
    },
  },

  'db:migrate': {
    description: 'Run pending database migrations',
    handler: async () => {
      console.log('\n🗃️  Running migrations...\n');
      try {
        const migrationsDir = resolve(process.cwd(), 'src/database/migrations');
        if (!existsSync(migrationsDir)) {
          console.log('No migrations directory found.');
          return;
        }

        const files = readdirSync(migrationsDir).filter(f => f.endsWith('.ts'));
        for (const file of files) {
          const migration = await import(join(migrationsDir, file));
          if (migration.default) {
            console.log(`  ▶ Running: ${file}`);
          }
        }

        // Import and run migrator
        const { migrator } = await import('canxjs');
        await migrator.run();
        console.log('\n✅ Migrations complete!\n');
      } catch (e) {
        console.error('Migration error:', e);
      }
    },
  },

  'db:rollback': {
    description: 'Rollback the last batch of migrations',
    handler: async () => {
      console.log('\n🔄 Rolling back migrations...\n');
      try {
        const { migrator } = await import('canxjs');
        await migrator.rollback();
        console.log('\n✅ Rollback complete!\n');
      } catch (e) {
        console.error('Rollback error:', e);
      }
    },
  },

  'db:seed': {
    description: 'Run database seeders',
    handler: async () => {
      console.log('\n🌱 Running seeders...\n');
      try {
        const seedersDir = resolve(process.cwd(), 'src/database/seeders');
        if (!existsSync(seedersDir)) {
          console.log('No seeders directory found.');
          return;
        }

        const files = readdirSync(seedersDir).filter(f => f.endsWith('.ts'));
        for (const file of files) {
          console.log(`  ▶ Running: ${file}`);
          const seeder = await import(join(seedersDir, file));
          if (seeder.default) {
            await seeder.default();
          }
        }
        console.log('\n✅ Seeding complete!\n');
      } catch (e) {
        console.error('Seeding error:', e);
      }
    },
  },

  'db:fresh': {
    description: 'Drop all tables and re-run migrations',
    handler: async () => {
      console.log('\n🔄 Refreshing database...\n');
      try {
        const { migrator } = await import('canxjs');
        await migrator.fresh();
        console.log('\n✅ Database refreshed!\n');
      } catch (e) {
        console.error('Fresh error:', e);
      }
    },
  },

  version: {
    description: 'Show CLI version',
    handler: () => {
      console.log(`CanxJS CLI v${VERSION}`);
    },
  },

  'version:list': {
    description: 'List available CanxJS versions from NPM',
    handler: async (args) => {
      console.log('\n📦 Fetching available versions from NPM...\n');
      try {
        const res = await fetch('https://registry.npmjs.org/canxjs');
        if (!res.ok) throw new Error('Failed to fetch from NPM registry');
        
        const data = await res.json() as { versions: Record<string, any>; 'dist-tags': Record<string, string> };
        const versions = Object.keys(data.versions).reverse();
        const latest = data['dist-tags']?.latest || versions[0];
        
        // Get current version
        let currentVersion = 'unknown';
        try {
          const pkg = JSON.parse(await Bun.file('package.json').text());
          currentVersion = pkg.dependencies?.canxjs?.replace(/[\^~]/, '') || 'not installed';
        } catch {}
        
        console.log(`  Current: ${currentVersion}`);
        console.log(`  Latest:  ${latest}\n`);
        console.log('  Available versions (newest first):');
        
        const limit = args.includes('--all') ? versions.length : 10;
        for (let i = 0; i < Math.min(limit, versions.length); i++) {
          const v = versions[i];
          const marker = v === currentVersion ? ' ← installed' : (v === latest ? ' ★ latest' : '');
          console.log(`    ${v}${marker}`);
        }
        
        if (versions.length > limit) {
          console.log(`\n  ... and ${versions.length - limit} more (use --all to see all)`);
        }
        console.log('');
      } catch (e: any) {
        console.error('❌ Failed to fetch versions:', e.message);
      }
    },
  },

  upgrade: {
    description: 'Upgrade CanxJS to latest or specified version',
    handler: async (args) => {
      const targetVersion = args[0] || 'latest';
      console.log('\n🚀 CanxJS Upgrade\n');
      
      try {
        // Get current version
        let currentVersion = 'unknown';
        try {
          const pkg = JSON.parse(await Bun.file('package.json').text());
          currentVersion = pkg.dependencies?.canxjs?.replace(/[\^~]/, '') || 'not installed';
        } catch {}
        
        // Get target version from NPM
        let resolvedVersion = targetVersion;
        if (targetVersion === 'latest') {
          const res = await fetch('https://registry.npmjs.org/canxjs/latest');
          if (!res.ok) throw new Error('Failed to fetch latest version');
          const data = await res.json() as { version: string };
          resolvedVersion = data.version;
        } else {
          // Validate version exists
          const res = await fetch(`https://registry.npmjs.org/canxjs/${targetVersion}`);
          if (!res.ok) throw new Error(`Version ${targetVersion} not found on NPM`);
          const data = await res.json() as { version: string };
          resolvedVersion = data.version;
        }
        
        console.log(`  Current version: ${currentVersion}`);
        console.log(`  Target version:  ${resolvedVersion}\n`);
        
        if (currentVersion === resolvedVersion) {
          console.log('✅ Already on the target version!\n');
          return;
        }
        
        // Check if we're downgrading (only for valid semantic versions)
        // Skip downgrade check for workspace:, unknown, not installed, or non-semver formats
        const isValidSemver = (v: string) => /^\d+\.\d+\.\d+/.test(v);
        const isDowngrade = isValidSemver(currentVersion) && 
                           isValidSemver(resolvedVersion) &&
                           resolvedVersion.localeCompare(currentVersion, undefined, { numeric: true }) < 0;
        
        if (isDowngrade && !args.includes('--force')) {
          console.log('⚠️  This would downgrade your version. Use --force to confirm.\n');
          console.log('   Or use: canx downgrade ' + resolvedVersion + '\n');
          return;
        }
        
        // Perform upgrade
        console.log('📥 Installing canxjs@' + resolvedVersion + '...\n');
        const result = spawnSync('bun', ['add', `canxjs@${resolvedVersion}`], { 
          stdio: 'inherit',
          cwd: process.cwd()
        });
        
        if (result.status === 0) {
          console.log('\n✅ Successfully upgraded to canxjs@' + resolvedVersion + '!\n');
          console.log('📝 Post-upgrade recommendations:');
          console.log('   1. Clear any caches: rm -rf node_modules/.cache');
          console.log('   2. Review CHANGELOG for breaking changes');
          console.log('   3. Run your test suite to verify compatibility\n');
        } else {
          console.error('\n❌ Upgrade failed. Please check the error above.\n');
        }
      } catch (e: any) {
        console.error('❌ Upgrade failed:', e.message);
      }
    },
  },

  downgrade: {
    description: 'Downgrade CanxJS to a specific version',
    handler: async (args) => {
      const targetVersion = args[0];
      console.log('\n⬇️  CanxJS Downgrade\n');
      
      if (!targetVersion) {
        console.error('Usage: canx downgrade <version>');
        console.log('\nExample: canx downgrade 1.0.0');
        console.log('\nUse "canx version:list" to see available versions.\n');
        process.exit(1);
      }
      
      try {
        // Get current version
        let currentVersion = 'unknown';
        try {
          const pkg = JSON.parse(await Bun.file('package.json').text());
          currentVersion = pkg.dependencies?.canxjs?.replace(/[\^~]/, '') || 'not installed';
        } catch {}
        
        // Validate version exists on NPM
        const res = await fetch(`https://registry.npmjs.org/canxjs/${targetVersion}`);
        if (!res.ok) {
          console.error(`❌ Version ${targetVersion} not found on NPM.`);
          console.log('\nUse "canx version:list" to see available versions.\n');
          process.exit(1);
        }
        
        console.log(`  Current version: ${currentVersion}`);
        console.log(`  Target version:  ${targetVersion}\n`);
        
        if (currentVersion === targetVersion) {
          console.log('✅ Already on the target version!\n');
          return;
        }
        
        // Warning for downgrade
        console.log('⚠️  WARNING: Downgrading may cause issues if your code uses');
        console.log('   features that were added in newer versions.\n');
        
        if (!args.includes('--force')) {
          console.log('   Add --force to proceed with the downgrade.\n');
          return;
        }
        
        // Perform downgrade
        console.log('📥 Installing canxjs@' + targetVersion + '...\n');
        const result = spawnSync('bun', ['add', `canxjs@${targetVersion}`], { 
          stdio: 'inherit',
          cwd: process.cwd()
        });
        
        if (result.status === 0) {
          console.log('\n✅ Successfully downgraded to canxjs@' + targetVersion + '!\n');
          console.log('📝 Post-downgrade recommendations:');
          console.log('   1. Review your code for any incompatible features');
          console.log('   2. Run your test suite to verify compatibility');
          console.log('   3. Check the CHANGELOG for breaking changes\n');
        } else {
          console.error('\n❌ Downgrade failed. Please check the error above.\n');
        }
      } catch (e: any) {
        console.error('❌ Downgrade failed:', e.message);
      }
    },
  },

  'self-update': {
    description: 'Update CanxJS CLI to the latest version (alias for upgrade)',
    handler: async (args) => {
      // Delegate to upgrade command
      await commands.upgrade.handler(['latest', ...args]);
    },
  },

  help: {
    description: 'Show help',
    handler: () => showHelp(),
  },
};

// ============================================
// Help & Entry Point
// ============================================

function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║            🚀 CanxJS CLI v${VERSION}                          ║
╚══════════════════════════════════════════════════════════╝

Usage:
  canx <command> [options]

Commands:`);

  // Group commands
  const groups: Record<string, string[]> = {
    'Project': ['new', 'create'],
    'Development': ['serve', 'build', 'routes', 'generate:client'],
    'Generators': ['make:controller', 'make:model', 'make:middleware', 'make:migration', 'make:seeder', 'make:service', 'make:notification'],
    'Database': ['db:migrate', 'db:rollback', 'db:seed', 'db:fresh'],
    'Version Management': ['upgrade', 'downgrade', 'version:list', 'self-update'],
    'Other': ['version', 'help'],
  };

  for (const [group, cmds] of Object.entries(groups)) {
    console.log(`\n  ${group}:`);
    for (const cmd of cmds) {
      const { description } = commands[cmd];
      console.log(`    ${cmd.padEnd(20)} ${description}`);
    }
  }

  console.log(`
Examples:
  canx serve                    # Start dev server with hot reload
  canx make:model User -m       # Generate User model with migration
  canx make:controller Post     # Generate PostController
  canx db:migrate               # Run pending migrations
  canx db:seed                  # Run all seeders
  canx upgrade                  # Upgrade to latest version
  canx upgrade 2.0.0            # Upgrade to specific version
  canx downgrade 1.5.0 --force  # Downgrade to specific version
  canx version:list             # List available versions
`);
}

// Entry point
const args = process.argv.slice(2);
const cmd = args[0] || 'help';
const cmdArgs = args.slice(1);
const handler = commands[cmd];

if (handler) {
  handler.handler(cmdArgs);
} else {
  console.error(`Unknown command: ${cmd}`);
  showHelp();
  process.exit(1);
}
