import { ModuleMetadata } from '../core/Module';
export interface Type<T = any> extends Function {
    new (...args: any[]): T;
}
export interface TestingModule {
    createNestApplication(): any;
    get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | string | symbol | Function): TResult;
    resolve<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | string | symbol | Function): Promise<TResult>;
    close(): Promise<void>;
    useLogger(logger: any): void;
}
export declare class TestingModuleBuilder {
    private metadata;
    private overrides;
    constructor(metadata: ModuleMetadata);
    overrideProvider(token: any): OverrideBy;
    compile(): Promise<TestingModule>;
}
export interface OverrideBy {
    useValue: (value: any) => TestingModuleBuilder;
    useClass: (metatype: Type<any>) => TestingModuleBuilder;
    useFactory: (factory: (...args: any[]) => any) => TestingModuleBuilder;
}
export declare class Test {
    static createTestingModule(metadata: ModuleMetadata): TestingModuleBuilder;
}
