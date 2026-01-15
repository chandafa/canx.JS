import { join } from 'path';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import pc from 'picocolors';
import type { Command } from '../Command';

export class MakeCommand implements Command {
  signature = 'make:<type> <name>';
  description = 'Create a new component (controller, model, middleware, migration, seeder)';

  async handle(args: string[], flags: Record<string, any>) {
    // args[0] is command name "make:model", args[1] is name "User"
    // Wait, my simple parser separates command name.
    // In cli/index.ts: handle(commandArgs, flags)
    // commandArgs will be ["User"] ?
    // No. In index.ts:
    // const commandName = args[0]; // "make:model"
    // params = args.slice(1); // ["User"]
    // handle() receives params. So args[0] is "User".
    
    // BUT, "make:<type>" is tricky if I register separate commands.
    // Console.ts logic: "make:model" is the command key.
    // So I need to register "make:model", "make:controller", etc. OR
    // register "make" and parse arg 1?
    // "canx make model User" vs "canx make:model User".
    // Laravel uses "make:model".
    
    // I will modify this class to support being instantiated with a specific type,
    // OR register multiple instances of this command with different signatures.
    // Let's go with specific classes logic inside this file or just one generic class and I assume the CALLER handles type?
    
    // Actually, in Console.ts, I splitting "make:model" is hard if my map key is "make:type".
    // I should register "make:controller", "make:model" separately in Console.ts using this same class logic.
    // So I need a way to know WHICH command was triggered.
    // I will store the 'type' in constructor.
  }
}

export class MakeGenerator implements Command {
    signature: string;
    description: string;
    type: string;

    constructor(type: string) {
        this.type = type;
        this.signature = `make:${type}`;
        this.description = `Create a new ${type}`;
    }

    async handle(args: string[], flags: Record<string, any>) {
        const name = args[0];
        if (!name) {
            console.error(pc.red(`Please provide a name for the ${this.type}.`));
            return;
        }

        const cwd = process.cwd();
        let content = '';
        let targetPath = '';

        switch(this.type) {
            case 'controller':
                content = this.getController(name);
                targetPath = join(cwd, 'src/controllers', `${name}.ts`);
                break;
            case 'model':
                content = this.getModel(name);
                targetPath = join(cwd, 'src/models', `${name}.ts`);
                break;
            case 'middleware':
                content = this.getMiddleware(name);
                targetPath = join(cwd, 'src/middlewares', `${name}.ts`);
                break;
            case 'migration':
                const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
                content = this.getMigration(name);
                targetPath = join(cwd, 'src/database/migrations', `${timestamp}_${name}.ts`);
                break;
            case 'seeder':
                content = this.getSeeder(name);
                targetPath = join(cwd, 'src/database/seeders', `${name}.ts`); // Wait, seeding in CanxJS uses src/database/Seed.ts? Or separate files?
                // Migration.ts has `seeder`.
                // Users might want separate seeders.
                // Assuming src/database/seeders structure.
                targetPath = join(cwd, 'src/database/seeders', `${name}.ts`);
                break;
        }

        if (filesExists(targetPath)) {
            console.error(pc.red(`${this.type} "${name}" already exists.`));
            return;
        }

        // Ensure directory
        const dir = targetPath.split(/[\\/]/).slice(0, -1).join('/');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        writeFileSync(targetPath, content);
        console.log(pc.green(`Created ${this.type}: ${targetPath}`));
    }

    getController(name: string) {
        return `import { Controller, Get } from 'canxjs';

export class ${name} extends Controller {
  @Get('/')
  index() {
    return { message: 'Hello from ${name}' };
  }
}
`;
    }

    getModel(name: string) {
        return `import { Model } from 'canxjs';

export class ${name} extends Model {
  static tableName = '${name.toLowerCase()}s';
}
`;
    }

    getMiddleware(name: string) {
        return `import type { MiddlewareHandler } from 'canxjs';

export const ${name}: MiddlewareHandler = async (req, res, next) => {
  // Logic
  return next();
};
`;
    }

    getMigration(name: string) {
         return `import { defineMigration } from 'canxjs';

export default defineMigration(
  '${name}',
  async () => {
    // await Schema.create('table', table => { ... });
  },
  async () => {
    // await Schema.drop('table');
  }
);
`;
    }

    getSeeder(name: string) {
        return `import { defineSeeder } from 'canxjs';

export default defineSeeder(async () => {
  // await User.create({ ... });
});
`;
    }
}

function filesExists(path: string) {
    return existsSync(path);
}
