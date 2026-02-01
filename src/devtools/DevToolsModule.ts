import { Module, CanxModule } from '../core/Module';
import { Controller, Get, Delete } from '../mvc/Controller';
import { Router } from '../core/Router';
import { ModuleContainer } from '../core/Module';
import { debugWatcher } from './DebugWatcher';

@Controller('devtools')
export class DevToolsController {
  constructor(
    private router: Router,
    private modules: ModuleContainer
  ) {}

  @Get('entries')
  getEntries(req: any) {
    const type = req.query.type;
    return debugWatcher.getEntries(type);
  }

  @Delete('entries')
  clearEntries() {
    debugWatcher.clear();
    return { success: true };
  }

  @Get('routes')
  getRoutes() {
    return this.router.getRoutes().map(r => ({
      method: r.method,
      path: r.path,
      handler: r.handler.name || 'Anonymous',
    }));
  }

  @Get('modules')
  getModules() {
    return {
      count: this.modules['modules'].length, // accessing private prop for devtools
      globalProviders: this.modules.getGlobalProviders().size,
      names: this.modules['modules'].map((m: any) => m.name),
    };
  }

  @Get('stats')
  getStats() {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid,
      bunVersion: Bun.version,
    };
  }
}

@CanxModule({
  controllers: [DevToolsController],
  providers: [
    {
        provide: 'DebugWatcher',
        useValue: debugWatcher
    }
  ]
})
export class DevToolsModule {}
