import { Module, CanxModule } from '../core/Module';
import { Controller, Get } from '../mvc/Controller';
import { Router } from '../core/Router';
import { ModuleContainer } from '../core/Module';

@Controller('devtools')
export class DevToolsController {
  constructor(
    private router: Router,
    private modules: ModuleContainer
  ) {}

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
    // In a real implementation, we'd traverse the ModuleContainer
    // For now we return simple stats
    return {
      count: this.modules['modules'].length, // accessing private prop for devtools
      globalProviders: this.modules.getGlobalProviders().size,
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
})
export class DevToolsModule {}
