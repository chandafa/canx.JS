/**
 * CanxJS Lifecycle Hooks
 * Interfaces for module lifecycle events
 */
/**
 * Called once the module has been initialized.
 * Can be used for any setup logic that needs dependencies to be resolved first.
 */
export interface OnModuleInit {
    onModuleInit(): any;
}
/**
 * Called once the module is destroyed or the application shuts down.
 * Use this to clean up resources, close connections, etc.
 */
export interface OnModuleDestroy {
    onModuleDestroy(): any;
}
/**
 * Called once all modules have been initialized and the application is ready to start.
 * Perfect for logic that requires the entire app graph to be ready.
 */
export interface OnApplicationBootstrap {
    onApplicationBootstrap(): any;
}
/**
 * Called just before the application begins its shutdown sequence.
 * Can be used to stop accepting new requests while finishing ongoing ones.
 * Receiving a signal (e.g. SIGINT) triggers this hook.
 */
export interface BeforeApplicationShutdown {
    beforeApplicationShutdown(signal?: string): any;
}
/**
 * Called when the application shuts down.
 * This is the last step in the lifecycle.
 */
export interface OnApplicationShutdown {
    onApplicationShutdown(signal?: string): any;
}
