import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import pc from 'picocolors';
import type { Command } from '../Command';
import { migrator } from '../../database/Migration';
import { initDatabase } from '../../mvc/Model';

export class MigrateCommand implements Command {
  signature = 'migrate [action]';
  description = 'Run database migrations. Actions: run (default), rollback, fresh, status';

  async handle(args: string[], flags: Record<string, any>) {
    const action = args[0] || 'run';
    const cwd = process.cwd();

    // 1. Load Database Config
    const configPath = join(cwd, 'src/config/database.ts');
    const jsConfigPath = join(cwd, 'src/config/database.js');
    
    let dbConfig;
    try {
      if (existsSync(configPath)) {
        const module = await import(configPath);
        dbConfig = module.default;
      } else if (existsSync(jsConfigPath)) {
        const module = await import(jsConfigPath);
        dbConfig = module.default;
      } else {
        console.error(pc.red('Config file src/config/database.{ts,js} not found.'));
        return;
      }
    } catch (e) {
      console.error(pc.red('Failed to load database config:'), e);
      return;
    }

    // 2. Initialize Database
    try {
      await initDatabase(dbConfig);
    } catch (e: any) {
      console.error(pc.red(`Database connection failed: ${e.message}`));
      return;
    }

    // 3. Load Migrations
    const migrationDir = join(cwd, 'src/database/migrations');
    if (!existsSync(migrationDir)) {
      console.log(pc.yellow('No migrations directory found at src/database/migrations.'));
      // We still run if we want to just check status or ensure table, but usually pointless.
      if (action !== 'status') return;
    } else {
      const files = readdirSync(migrationDir)
        .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
        .sort(); // Sort by name (timestamp)

      if (files.length === 0) {
        console.log(pc.yellow('No migration files found.'));
      }

      for (const file of files) {
        await import(join(migrationDir, file));
      }
    }

    // 4. Run Action
    try {
      switch (action) {
        case 'run':
          await migrator.run();
          break;
        case 'rollback':
          await migrator.rollback();
          break;
        case 'fresh':
          await migrator.fresh();
          break;
        case 'reset':
          await migrator.reset();
          break;
        case 'status':
          const status = await migrator.status();
          console.table(status);
          break;
        default:
          console.error(pc.red(`Unknown action "${action}". Use run, rollback, fresh, reset, or status.`));
      }
    } catch (e: any) {
       console.error(pc.red(`Migration failed:`), e);
    }
    
    process.exit(0);
  }
}
