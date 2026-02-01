/**
 * Base Action Class
 * Actions represent a single task or operation in your application.
 * They encourage the "Single Responsibility Principle" and are easily testable.
 */
export declare abstract class Action<TInput = any, TOutput = any> {
    /**
     * Run the action
     * @param input The input data for the action
     */
    abstract handle(input: TInput): TOutput | Promise<TOutput>;
    /**
     * Execute the action statically resolving from the container
     * @param input The input data for the action
     */
    static run<T extends Action<any, any>>(this: new () => T, input?: any): Promise<ReturnType<T['handle']>>;
    /**
     * Execute the action as a standalone function (for passing to other functions)
     */
    static asFunction<T extends Action<any, any>>(this: new () => T): (input: any) => Promise<any>;
}
