/**
 * CanxJS Application
 * The central entry point for bootstrapping a CanxJS application.
 */

import { container } from '../container/Container';
import { ModuleContainer } from './Module';
import { GatewayManager } from '../realtime/GatewayManager';
import { Server as CanxServer } from './Server';
import { Router } from './Router';
import { env } from '../utils/Env';
import type { ServerConfig } from '../types';
import type { CanxApplication } from '../types';

export interface ApplicationConfig extends ServerConfig {
  modules?: any[];
  rootModule?: any;
  /**
   * Controllers to register globally
   */
  controllers?: any[];
  /**
   * Global middleware
   */
  middleware?: any[];
}

export class Application {
  private server: CanxServer;
  private moduleContainer: ModuleContainer;
  private static instance: Application;

  constructor(config: ApplicationConfig = {}) {
    // Initialize server with a default handler that delegates to the router (in start)
    // or just a placeholder if start() sets it up. 
    // Wait, Server class in Server.ts assigns this.requestHandler = handler.
    // And uses it in fetch(). So we MUST provide the real handler or a proxy.
    // We'll provide a proxy that calls the router which we'll initialize.
    
    const router = new Router(config as any);
    container.instance('Router', router);

    this.server = new CanxServer(config, async (req) => {
       // Create Context
       // We need to import createCanxRequest, createCanxResponse from Server?
       // They are exported from './Server' module but maybe not Server class.
       // We need to import them at top.
       
       // For now, let's use the Router match directly if we can't fully emulate the pipeline yet,
       // Or simpler: just fix the handle call to what Router supports.
       
       // Router doesn't have handle. It has match.
       // We need to construct req/res abstractions.
       
       // Dynamic import to avoid circular dependency issues if any
       const { createCanxRequest, createCanxResponse } = await import('./Server');
       
       const canxReq = createCanxRequest(req);
       const canxRes = createCanxResponse();
       
       const match = router.match(canxReq.method, canxReq.path);
       if (match) {
           // Assign params
           canxReq.params = match.params || {};
           
           try {
             // Execute middlewares sequentially
             const middlewares = match.middlewares || [];
             let index = -1;
             
             const dispatch = async (i: number): Promise<any> => {
                if (i <= index) throw new Error('next() called multiple times');
                index = i;
                
                if (i === middlewares.length) {
                    return match.handler(canxReq, canxRes);
                }
                
                const fn = middlewares[i];
                return fn(canxReq, canxRes, () => dispatch(i + 1));
             };
             
             const result = await dispatch(0);
             
             if (result instanceof Response) return result;
             if (typeof result === 'string') return canxRes.html(result);
             return canxRes.json(result);
           } catch(e: any) {
             console.error(e);
             return new Response('Internal Server Error', { status: 500 });
           }
       }
       
       return new Response('Not Found', { status: 404 });
    });

    this.moduleContainer = container.get(ModuleContainer) as ModuleContainer;
    
    // Register Root Module if provided
    if (config.rootModule) {
      this.moduleContainer.register(config.rootModule);
    }
    
    // Register extra modules
    if (config.modules) {
      config.modules.forEach(mod => this.moduleContainer.register(mod));
    }
    
    Application.instance = this;
  }

  /**
   * Get application instance
   */
  static getInstance(): Application {
    if (!Application.instance) {
      throw new Error('Application not initialized. Call new Application() first.');
    }
    return Application.instance;
  }

  /**
   * Get the underlying server
   */
  getServer(): CanxServer {
    return this.server;
  }

  /**
   * Start the application
   */
  async start() {
    // 1. Initialize Modules (resolve dependencies)
    // In a real scenario, we might want to manually iterate and "load" modules here if not done.
    
    // 2. Lifecycle: OnModuleInit
    await this.moduleContainer.callOnModuleInit();

    // 3. Lifecycle: OnApplicationBootstrap
    await this.moduleContainer.callOnApplicationBootstrap();

    // 4. Initialize WebSocket Gateways
    const gatewayManager = new GatewayManager(this.moduleContainer);
    gatewayManager.registerGateways();

    // 4.5 Register Controllers to Router
    // Scan instances in container for those marked as controllers
    // This is a naive scan of all container instances, in a real app we'd track controllers separately
    // But since Module system now registers controllers as providers, we can iterate tokens.
    // However, container doesn't expose easy iteration of instances.
    // Better approach: ModuleContainer keeps track of controllers during registration.
    
    // For now, let's assume ModuleContainer has a method to get all controllers, 
    // OR we iterate through registered modules and their controllers.
    // Let's implement keys/instances iteration in ModuleContainer or just use the metadata approach
    const router = container.get('Router') as any; // Resolve router
    
    // Naive fallback: if we have rootModule, we can re-scan its metadata
    // But ModuleContainer.register already flattened them.
    
    // Let's iterate the moduleContainer's instances if possible
    // We need to modify Module to expose controllers or instances.
    // For this fix, let's update ModuleContainer to track controllers.
    const controllers = this.moduleContainer.getControllers();
    
    if (controllers && router) {
       controllers.forEach(ctrl => {
          router.registerController(ctrl);
       });
    }

    // 5. Start Server
    const port = Number(env('PORT', 3000));
    await this.server.listen();
    
    console.log(`\n🚀 CanxJS Application running at http://localhost:${port}\n`);
  }

  /**
   * Enable graceful shutdown hooks
   */
  enableShutdownHooks(signals: string[] = ['SIGTERM', 'SIGINT']) {
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\n[CanxJS] Received ${signal}. Shutting down gracefully...`);
        await this.close(signal);
        process.exit(0);
      });
    });
    return this;
  }

  /**
   * Stop the application
   */
  async close(signal?: string) {
    // 1. Lifecycle: BeforeApplicationShutdown
    await this.moduleContainer.callBeforeApplicationShutdown(signal);

    // 2. Stop Server
    await this.server.close();

    // 3. Lifecycle: OnModuleDestroy
    await this.moduleContainer.callOnModuleDestroy();

    // 4. Lifecycle: OnApplicationShutdown
    await this.moduleContainer.callOnApplicationShutdown(signal);
  }

  /**
   * Bind a value to the DI container
   */
  bind<T>(token: string | symbol, value: T) {
    container.instance(token, value);
    return this;
  }
}

/**
 * Create a new CanxJS Application
 */
export function createApplication(config: ApplicationConfig = {}): Application {
  return new Application(config);
}
