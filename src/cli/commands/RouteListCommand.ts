import { join, resolve } from 'path';
import { existsSync } from 'fs';
import pc from 'picocolors';
import type { Command } from '../Command';
import type { Canx } from '../../Application';

export class RouteListCommand implements Command {
  signature = 'route:list';
  description = 'List all registered routes';

  async handle(args: string[], flags: Record<string, any>) {
    const cwd = process.cwd();
    
    // Try to find the app entry point
    const candidates = [
      'src/server.ts', 'server.ts',
      'src/index.ts', 'index.ts',
      'src/main.ts', 'main.ts',
      'src/app.ts', 'app.ts'
    ];

    let app: Canx | null = null;
    let loadedFile = '';

    for (const file of candidates) {
      const fullPath = join(cwd, file);
      if (existsSync(fullPath)) {
        try {
          const mod = await import(fullPath);
          // Check for 'app' or default export that looks like Canx
          if (mod.app && mod.app.router) {
            app = mod.app;
          } else if (mod.default && mod.default.router) {
            app = mod.default;
          }
          
          if (app) {
            loadedFile = file;
            break;
          }
        } catch (e) {
          // Ignore import errors, try next
          // console.error(e);
        }
      }
    }

    if (!app) {
      console.error(pc.red('Could not find Canx application instance.'));
      console.error(pc.yellow('Make sure your entry file (e.g., src/server.ts) exports the "app" instance.'));
      return;
    }

    console.log(pc.gray(`Loaded application from ${loadedFile}`));

    const routes = app.router.getRoutes();
    
    if (routes.length === 0) {
      console.warn(pc.yellow('No routes registered.'));
      return;
    }

    console.log('\n' + pc.bold('Registered Routes:'));
    console.log('------------------------------------------------------------');
    
    // Calculate padding
    const methodPad = 8;
    const pathPad = 50;

    routes.forEach(route => {
        let method = route.method.toUpperCase();
        const color = this.getMethodColor(method);
        
        console.log(
            color(method.padEnd(methodPad)) + 
            pc.white(route.path.padEnd(pathPad)) + 
            pc.gray(`[Middlewares: ${(route.middlewares || []).length}]`)
        );
    });
    console.log('------------------------------------------------------------\n');
  }

  private getMethodColor(method: string) {
      switch(method) {
          case 'GET': return pc.blue;
          case 'POST': return pc.yellow;
          case 'PUT': return pc.cyan;
          case 'DELETE': return pc.red;
          default: return pc.white;
      }
  }
}
