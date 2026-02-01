"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MakeGenerator = exports.MakeCommand = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const picocolors_1 = __importDefault(require("picocolors"));
class MakeCommand {
    signature = 'make:<type> <name>';
    description = 'Create a new component (controller, model, middleware, migration, seeder, request, resource, policy, service)';
    async handle(args, flags) {
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
exports.MakeCommand = MakeCommand;
class MakeGenerator {
    signature;
    description;
    type;
    constructor(type) {
        this.type = type;
        this.signature = `make:${type}`;
        this.description = `Create a new ${type}`;
    }
    async handle(args, flags) {
        const name = args[0];
        if (!name) {
            console.error(picocolors_1.default.red(`Please provide a name for the ${this.type}.`));
            return;
        }
        // Validate name to prevent path traversal and invalid chars
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
            console.error(picocolors_1.default.red(`Invalid name "${name}". Names must start with an uppercase letter and contain only alphanumeric characters.`));
            return;
        }
        const cwd = process.cwd();
        let content = '';
        let targetPath = '';
        switch (this.type) {
            case 'controller':
                content = this.getController(name);
                targetPath = (0, path_1.join)(cwd, 'src/controllers', `${name}.ts`);
                break;
            case 'model':
                content = this.getModel(name);
                targetPath = (0, path_1.join)(cwd, 'src/models', `${name}.ts`);
                break;
            case 'middleware':
                content = this.getMiddleware(name);
                targetPath = (0, path_1.join)(cwd, 'src/middlewares', `${name}.ts`);
                break;
            case 'migration':
                const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
                content = this.getMigration(name);
                targetPath = (0, path_1.join)(cwd, 'src/database/migrations', `${timestamp}_${name}.ts`);
                break;
            case 'seeder':
                content = this.getSeeder(name);
                targetPath = (0, path_1.join)(cwd, 'src/database/seeders', `${name}.ts`);
                break;
            case 'request':
                content = this.getRequest(name);
                targetPath = (0, path_1.join)(cwd, 'src/requests', `${name}.ts`);
                break;
            case 'resource':
                content = this.getResource(name);
                targetPath = (0, path_1.join)(cwd, 'src/resources', `${name}.ts`);
                break;
            case 'policy':
                content = this.getPolicy(name);
                targetPath = (0, path_1.join)(cwd, 'src/policies', `${name}.ts`);
                break;
            case 'service':
                content = this.getService(name);
                targetPath = (0, path_1.join)(cwd, 'src/services', `${name}.ts`);
                break;
            case 'event':
                content = this.getEvent(name);
                targetPath = (0, path_1.join)(cwd, 'src/events', `${name}.ts`);
                break;
            case 'job':
                content = this.getJob(name);
                targetPath = (0, path_1.join)(cwd, 'src/jobs', `${name}.ts`);
                break;
            case 'notification':
                content = this.getNotification(name);
                targetPath = (0, path_1.join)(cwd, 'src/notifications', `${name}.ts`);
                break;
            case 'mail':
                content = this.getMail(name);
                targetPath = (0, path_1.join)(cwd, 'src/mails', `${name}.ts`);
                break;
            // New Generators
            case 'action':
                content = this.getAction(name);
                targetPath = (0, path_1.join)(cwd, 'src/actions', `${name}.ts`);
                break;
            case 'dto':
                content = this.getDto(name);
                targetPath = (0, path_1.join)(cwd, 'src/dtos', `${name}.ts`);
                break;
            case 'provider':
                content = this.getProvider(name);
                targetPath = (0, path_1.join)(cwd, 'src/providers', `${name}.ts`);
                break;
            case 'command':
                content = this.getCommand(name);
                targetPath = (0, path_1.join)(cwd, 'src/commands', `${name}.ts`);
                break;
        }
        if (filesExists(targetPath)) {
            console.error(picocolors_1.default.red(`${this.type} "${name}" already exists.`));
            return;
        }
        // Ensure directory
        const dir = targetPath.split(/[\\/]/).slice(0, -1).join('/');
        if (!(0, fs_1.existsSync)(dir))
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        (0, fs_1.writeFileSync)(targetPath, content);
        console.log(picocolors_1.default.green(`Created ${this.type}: ${targetPath}`));
    }
    getController(name) {
        return `import { Controller, Get, type CanxRequest } from 'canxjs';

export class ${name} extends Controller {
  @Get('/')
  index(req: CanxRequest) {
    return this.render('${name}/index', { message: 'Hello from ${name}' });
  }
}
`;
    }
    getModel(name) {
        return `import { Model } from 'canxjs';

export class ${name} extends Model {
  static tableName = '${name.toLowerCase()}s';
  
  // Define columns if not using JIT auto-discovery
  // id!: number;
}
`;
    }
    getMiddleware(name) {
        return `import type { MiddlewareHandler } from 'canxjs';

export const ${name}: MiddlewareHandler = async (req, res, next) => {
  // Logic
  return next();
};
`;
    }
    getMigration(name) {
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
    getSeeder(name) {
        return `import { defineSeeder } from 'canxjs';

export default defineSeeder(async () => {
  // await User.create({ ... });
});
`;
    }
    getRequest(name) {
        return `import { FormRequest, type ValidationSchema } from 'canxjs';

export class ${name} extends FormRequest {
  /**
   * Determine if the user is authorized to make this request.
   */
  authorize(): boolean {
    return true;
  }

  /**
   * Get the validation rules that apply to the request.
   */
  rules(): ValidationSchema {
    return {
      // name: 'required|string|min:3',
      // email: 'required|email',
    };
  }

  /**
   * Custom error messages (optional).
   */
  messages(): Record<string, string> {
    return {
      // 'name.required': 'Please provide a name.',
    };
  }
}
`;
    }
    getResource(name) {
        // Extract model name from resource name (e.g., UserResource -> User)
        const modelName = name.replace(/Resource$/, '');
        return `import { JsonResource, when, type CanxRequest } from 'canxjs';

export class ${name} extends JsonResource<any> {
  /**
   * Transform the resource into an array.
   */
  toArray(request?: CanxRequest): Record<string, unknown> {
    return {
      id: this.resource.id,
      // name: this.resource.name,
      // email: this.resource.email,
      // created_at: this.resource.created_at,
      
      // Conditional attributes
      // secret: when(this.resource.isAdmin, this.resource.secret),
    };
  }
}
`;
    }
    getPolicy(name) {
        // Extract model name from policy name (e.g., PostPolicy -> Post)
        const modelName = name.replace(/Policy$/, '');
        return `import { definePolicy } from 'canxjs';

/**
 * Policy for ${modelName} authorization.
 */
export const ${name} = definePolicy({
  /**
   * Determine if the user can view any ${modelName.toLowerCase()}s.
   */
  viewAny(user: any): boolean {
    return true;
  },

  /**
   * Determine if the user can view the ${modelName.toLowerCase()}.
   */
  view(user: any, ${modelName.toLowerCase()}: any): boolean {
    return true;
  },

  /**
   * Determine if the user can create ${modelName.toLowerCase()}s.
   */
  create(user: any): boolean {
    return true;
  },

  /**
   * Determine if the user can update the ${modelName.toLowerCase()}.
   */
  update(user: any, ${modelName.toLowerCase()}: any): boolean {
    return user.id === ${modelName.toLowerCase()}.user_id;
  },

  /**
   * Determine if the user can delete the ${modelName.toLowerCase()}.
   */
  delete(user: any, ${modelName.toLowerCase()}: any): boolean {
    return user.id === ${modelName.toLowerCase()}.user_id;
  },
});
`;
    }
    getService(name) {
        return `import { Injectable } from 'canxjs';

/**
 * ${name} Service
 * Business logic should be placed in services for better separation of concerns.
 */
@Injectable()
export class ${name} {
  /**
   * Example method - replace with your business logic
   */
  async findAll(): Promise<any[]> {
    // Implement your logic here
    return [];
  }

  /**
   * Example method - replace with your business logic
   */
  async findById(id: number): Promise<any | null> {
    // Implement your logic here
    return null;
  }
}
`;
    }
    getEvent(name) {
        return `import { events } from 'canxjs';

/**
 * ${name} Event
 * Events are dispatched when something happens in your application.
 */
export class ${name} {
  constructor(
    public readonly data: Record<string, unknown>
  ) {}

  /**
   * Dispatch this event
   */
  static dispatch(data: Record<string, unknown>): void {
    events.emit('${name}', new ${name}(data));
  }
}

/**
 * Register event listener
 * Add this to your bootstrap file or service provider
 */
export function register${name}Listeners(): void {
  events.on('${name}', (event: ${name}) => {
    // Handle the event
    console.log('${name} received:', event.data);
  });
}
`;
    }
    getJob(name) {
        return `import { queue } from 'canxjs';

/**
 * ${name} Job
 * Jobs are queued tasks that can be processed asynchronously.
 */
export interface ${name}Data {
  // Define your job payload here
  id?: number;
  [key: string]: unknown;
}

export class ${name} {
  static readonly jobName = '${name.toLowerCase()}';

  /**
   * Dispatch this job to the queue
   */
  static async dispatch(data: ${name}Data): Promise<string> {
    return queue.dispatch(${name}.jobName, data);
  }

  /**
   * Handle the job
   * This is called when the job is processed
   */
  static async handle(data: ${name}Data): Promise<void> {
    // Implement your job logic here
    console.log('Processing ${name}:', data);
  }

  /**
   * Register this job handler
   * Call this in your bootstrap file
   */
  static register(): void {
    queue.define(${name}.jobName, ${name}.handle);
  }
}
`;
    }
    getNotification(name) {
        return `import { Notification } from 'canxjs';
import type { Notifiable, NotificationChannel } from 'canxjs';

/**
 * ${name} Notification
 * Notifications can be sent via mail, database, or other channels.
 */
export class ${name} extends Notification {
  constructor(
    private data: Record<string, unknown>
  ) {
    super();
  }

  /**
   * Define which channels this notification should be sent through
   */
  via(notifiable: Notifiable): NotificationChannel[] {
    return ['mail', 'database'];
  }

  /**
   * Get the mail representation of the notification
   */
  toMail(notifiable: Notifiable): Record<string, unknown> {
    return {
      subject: '${name} Notification',
      body: 'You have a new notification.',
      data: this.data,
    };
  }

  /**
   * Get the database representation of the notification
   */
  toDatabase(notifiable: Notifiable): Record<string, unknown> {
    return {
      type: '${name}',
      data: this.data,
    };
  }
}
`;
    }
    getMail(name) {
        return `import { MailBuilder } from 'canxjs';

/**
 * ${name} Mail
 * Mailable classes encapsulate email logic.
 */
export class ${name} {
  constructor(
    private data: Record<string, unknown> = {}
  ) {}

  /**
   * Build the email
   */
  build(): MailBuilder {
    return new MailBuilder()
      .subject('${name.replace(/([A-Z])/g, ' $1').trim()}')
      .view('emails/${name.toLowerCase()}', this.data);
  }

  /**
   * Send to a recipient
   */
  async sendTo(email: string): Promise<void> {
    await this.build().to(email).send();
  }
}
`;
    }
    // ==========================================
    // New Features
    // ==========================================
    getAction(name) {
        return `import { Action, Injectable } from 'canxjs';

/**
 * ${name} Action
 * Encapsulates a single task or business rule.
 */
@Injectable()
export class ${name} extends Action {
  /**
   * Execute the action
   */
  async handle(input: any): Promise<any> {
    // Implement your action logic here
    return input;
  }
}
`;
    }
    getDto(name) {
        return `import { z, type Infer } from 'canxjs';

// Define the schema
export const ${name}Schema = z.object({
  // Define schema properties
  // name: z.string().min(3),
  // email: z.string().email(),
});

/**
 * ${name} Data Transfer Object
 */
export type ${name} = Infer<typeof ${name}Schema>;

export const validate${name} = (data: unknown) => {
  return ${name}Schema.parse(data);
};
`;
    }
    getProvider(name) {
        return `import { ServiceProvider } from 'canxjs';

export class ${name} extends ServiceProvider {
  /**
   * Register services into the container.
   */
  register(): void {
    // this.app.bind('service', () => new Service());
  }

  /**
   * Bootstrap any application services.
   */
  async boot(): Promise<void> {
    // Code to run after all providers function registered
  }
}
`;
    }
    getCommand(name) {
        // Convert CamelCase to kebab-case for signature
        const commandName = name.replace(/([a-z0-9])([A-Z])/g, '$1:$2').toLowerCase();
        return `import type { Command } from 'canxjs/cli';
import pc from 'picocolors';

export class ${name} implements Command {
  signature = 'app:${commandName}';
  description = 'My custom command';

  async handle(args: string[], flags: Record<string, any>): Promise<void> {
    console.log(pc.green('${name} executed!'));
    // Command logic here
  }
}
`;
    }
}
exports.MakeGenerator = MakeGenerator;
function filesExists(path) {
    return (0, fs_1.existsSync)(path);
}
