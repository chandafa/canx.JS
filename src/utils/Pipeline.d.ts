/**
 * CanxJS Pipeline
 * Laravel-style pipeline pattern for processing data through stages
 */
export type PipeHandler<T> = (data: T, next: (data: T) => Promise<T>) => Promise<T> | T;
export type PipeFunction<T> = (data: T) => Promise<T> | T;
export interface PipeStage<T> {
    handle: PipeHandler<T>;
}
export declare class Pipeline<T> {
    private passable;
    private pipes;
    constructor(passable?: T);
    /**
     * Set the data to pass through pipeline
     */
    send(passable: T): this;
    /**
     * Add pipes to the pipeline
     */
    through(pipes: Array<PipeHandler<T> | PipeStage<T> | (new () => PipeStage<T>)>): this;
    /**
     * Add a single pipe
     */
    pipe(handler: PipeHandler<T> | PipeStage<T>): this;
    /**
     * Execute the pipeline and get the result
     */
    then<R = T>(destination?: (data: T) => R | Promise<R>): Promise<R>;
    /**
     * Execute the pipeline (alias for then without destination)
     */
    run(): Promise<T>;
    /**
     * Execute and return result
     */
    thenReturn(): Promise<T>;
}
/**
 * Create a new pipeline
 */
export declare function pipeline<T>(passable?: T): Pipeline<T>;
/**
 * Create a pipe stage class
 */
export declare function createPipe<T>(handler: PipeHandler<T>): PipeStage<T>;
/**
 * Tap - perform action without modifying data
 */
export declare function tap<T>(action: (data: T) => void | Promise<void>): PipeHandler<T>;
/**
 * When - conditionally apply transformation
 */
export declare function when<T>(condition: boolean | ((data: T) => boolean), handler: PipeHandler<T>): PipeHandler<T>;
/**
 * Unless - inverse of when
 */
export declare function unless<T>(condition: boolean | ((data: T) => boolean), handler: PipeHandler<T>): PipeHandler<T>;
/**
 * Transform - apply transformation to data
 */
export declare function transform<T>(transformer: (data: T) => T | Promise<T>): PipeHandler<T>;
export default Pipeline;
