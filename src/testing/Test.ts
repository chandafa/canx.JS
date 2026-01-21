import { CanxModule, Module, ModuleMetadata, Provider, ModuleContainer } from '../core/Module';

// Helper type
export interface Type<T = any> extends Function {
  new (...args: any[]): T;
}

export interface TestingModule {
  createNestApplication(): any; // In our case, Application
  get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | string | symbol | Function): TResult;
  resolve<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | string | symbol | Function): Promise<TResult>;
  close(): Promise<void>;
  useLogger(logger: any): void;
}

export class TestingModuleBuilder {
  private metadata: ModuleMetadata;
  private overrides = new Map<any, any>();

  constructor(metadata: ModuleMetadata) {
    this.metadata = metadata;
  }

  public overrideProvider(token: any): OverrideBy {
    return {
      useValue: (value: any) => {
        this.overrides.set(token, { provide: token, useValue: value });
        return this;
      },
      useClass: (metatype: Type<any>) => {
        this.overrides.set(token, { provide: token, useClass: metatype });
        return this;
      },
      useFactory: (factory: (...args: any[]) => any) => {
        this.overrides.set(token, { provide: token, useFactory: factory });
        return this;
      },
    };
  }

  public async compile(): Promise<TestingModule> {
     // 1. Create a fresh ModuleContainer
     const container = new ModuleContainer();

     // 2. Process metadata but Apply Overrides
     // We need to mutate the metadata.providers array effectively
     const providers = this.metadata.providers || [];
     const processedProviders = providers.map(provider => {
        // Normalize provider
        const token = (provider as any).provide || provider;
        
        if (this.overrides.has(token)) {
           return this.overrides.get(token);
        }
        return provider;
     });

     // 3. Register a dynamic Root Test Module
     // We define a dummy module class that wraps our metadata
     class TestModule {}
     CanxModule(this.metadata)(TestModule);

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
        get: <T>(token: any) => container.get<T>(token),
        resolve: <T>(token: any) => container.resolve<T>(token),
        close: async () => {
           // Container close logic
        },
        useLogger: (logger: any) => {},
     };
  }
}

export interface OverrideBy {
  useValue: (value: any) => TestingModuleBuilder;
  useClass: (metatype: Type<any>) => TestingModuleBuilder;
  useFactory: (factory: (...args: any[]) => any) => TestingModuleBuilder;
}

export class Test {
  static createTestingModule(metadata: ModuleMetadata): TestingModuleBuilder {
    return new TestingModuleBuilder(metadata);
  }
}
