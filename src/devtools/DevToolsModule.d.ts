import { Router } from '../core/Router';
import { ModuleContainer } from '../core/Module';
export declare class DevToolsController {
    private router;
    private modules;
    constructor(router: Router, modules: ModuleContainer);
    getRoutes(): {
        method: import("..").HttpMethod;
        path: string;
        handler: string;
    }[];
    getModules(): {
        count: number;
        globalProviders: number;
    };
    getStats(): {
        memory: NodeJS.MemoryUsage;
        uptime: number;
        pid: number;
        bunVersion: string;
    };
}
export declare class DevToolsModule {
}
