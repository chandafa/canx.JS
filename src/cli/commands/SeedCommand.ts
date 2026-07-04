import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import pc from 'picocolors';
import type { Command } from '../Command';
import { seeder } from '../../database/Seeder';
import { initDatabase } from '../../mvc/Model';

/**
 * db:seed — run database seeders.
 *   canx db:seed              run every registered seeder
 *   canx db:seed --class=Foo  run only the seeder named "Foo"
 */
export class SeedCommand implements Command {
  signature = 'db:seed';
  description = 'Run the database seeders (all, or one via --class=Name)';

  async handle(args: string[], flags: Record<string, any>) {
    const cwd = process.cwd();

    // 1. Load database config (same convention as `canx migrate`).
    const configPath = join(cwd, 'src/config/database.ts');
    const jsConfigPath = join(cwd, 'src/config/database.js');
    let dbConfig: any;
    try {
      if (existsSync(configPath)) dbConfig = (await import(configPath)).default;
      else if (existsSync(jsConfigPath)) dbConfig = (await import(jsConfigPath)).default;
      else {
        console.error(pc.red('Config file src/config/database.{ts,js} not found.'));
        return;
      }
    } catch (e) {
      console.error(pc.red('Failed to load database config:'), e);
      return;
    }

    // 2. Connect.
    try {
      await initDatabase(dbConfig);
    } catch (e: any) {
      console.error(pc.red(`Database connection failed: ${e.message}`));
      return;
    }

    // 3. Import every seeder file so each defineSeeder() registers itself.
    const seederDir = join(cwd, 'src/database/seeders');
    if (!existsSync(seederDir)) {
      console.log(pc.yellow('No seeders directory found at src/database/seeders.'));
      return;
    }
    const files = readdirSync(seederDir)
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();
    for (const file of files) {
      await import(join(seederDir, file));
    }

    // 4. Run (optionally a single named seeder).
    const only = flags.class || flags.only || args[0];
    try {
      await seeder.run(only);
      console.log(pc.green('Database seeding completed.'));
    } catch (e: any) {
      console.error(pc.red('Seeding failed:'), e);
    }
    process.exit(0);
  }
}
