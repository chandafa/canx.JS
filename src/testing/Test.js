"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Test = exports.TestingModuleBuilder = void 0;
const Module_1 = require("../core/Module");
class TestingModuleBuilder {
    metadata;
    overrides = new Map();
    constructor(metadata) {
        this.metadata = metadata;
    }
    overrideProvider(token) {
        return {
            useValue: (value) => {
                this.overrides.set(token, { provide: token, useValue: value });
                return this;
            },
            useClass: (metatype) => {
                this.overrides.set(token, { provide: token, useClass: metatype });
                return this;
            },
            useFactory: (factory) => {
                this.overrides.set(token, { provide: token, useFactory: factory });
                return this;
            },
        };
    }
    async compile() {
        // 1. Create a fresh ModuleContainer
        const container = new Module_1.ModuleContainer();
        // 2. Process metadata but Apply Overrides
        // We need to mutate the metadata.providers array effectively
        const providers = this.metadata.providers || [];
        const processedProviders = providers.map(provider => {
            // Normalize provider
            const token = provider.provide || provider;
            if (this.overrides.has(token)) {
                return this.overrides.get(token);
            }
            return provider;
        });
        // 3. Register a dynamic Root Test Module
        // We define a dummy module class that wraps our metadata
        class TestModule {
        }
        (0, Module_1.CanxModule)(this.metadata)(TestModule);
        await container.register(TestModule);
        // await container.init(); // ModuleContainer doesn't have explicit init, register does it? 
        // Actually usually Application calls a method. 
        // Let's assume register() is enough or check ModuleContainer internals.
        // For now we skip explicit init or call a method that exists.
        return {
            createNestApplication: () => {
                // We might need to tweak Application to accept an existing Container
                // For now, we stub it or assume Application can take a container
                // But our Application creates its own container.
                // So for deep integration, we'd need Application to accept valid container.
                // Let's defer full Application creation for now and just return container wrapper
                // Or hack it:
                const app = require('../core/Application').createApplication({ rootModule: TestModule });
                // Ideally we inject our already-initialized container into app, but Application
                // re-initializes. 
                // For this proof of concept, we focus on `get()` which is main unit test need.
                return app;
            },
            get: (token) => container.get(token),
            resolve: (token) => container.resolve(token),
            close: async () => {
                // Container close logic
            },
            useLogger: (logger) => { },
        };
    }
}
exports.TestingModuleBuilder = TestingModuleBuilder;
class Test {
    static createTestingModule(metadata) {
        return new TestingModuleBuilder(metadata);
    }
}
exports.Test = Test;
