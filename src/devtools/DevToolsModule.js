"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevToolsModule = exports.DevToolsController = void 0;
const Module_1 = require("../core/Module");
const Controller_1 = require("../mvc/Controller");
const Router_1 = require("../core/Router");
const Module_2 = require("../core/Module");
let DevToolsController = class DevToolsController {
    router;
    modules;
    constructor(router, modules) {
        this.router = router;
        this.modules = modules;
    }
    getRoutes() {
        return this.router.getRoutes().map(r => ({
            method: r.method,
            path: r.path,
            handler: r.handler.name || 'Anonymous',
        }));
    }
    getModules() {
        // In a real implementation, we'd traverse the ModuleContainer
        // For now we return simple stats
        return {
            count: this.modules['modules'].length, // accessing private prop for devtools
            globalProviders: this.modules.getGlobalProviders().size,
        };
    }
    getStats() {
        return {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            pid: process.pid,
            bunVersion: Bun.version,
        };
    }
};
exports.DevToolsController = DevToolsController;
__decorate([
    (0, Controller_1.Get)('routes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DevToolsController.prototype, "getRoutes", null);
__decorate([
    (0, Controller_1.Get)('modules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DevToolsController.prototype, "getModules", null);
__decorate([
    (0, Controller_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DevToolsController.prototype, "getStats", null);
exports.DevToolsController = DevToolsController = __decorate([
    (0, Controller_1.Controller)('devtools'),
    __metadata("design:paramtypes", [Router_1.Router,
        Module_2.ModuleContainer])
], DevToolsController);
let DevToolsModule = class DevToolsModule {
};
exports.DevToolsModule = DevToolsModule;
exports.DevToolsModule = DevToolsModule = __decorate([
    (0, Module_1.CanxModule)({
        controllers: [DevToolsController],
    })
], DevToolsModule);
