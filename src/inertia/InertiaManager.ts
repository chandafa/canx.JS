import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';

export interface InertiaConfig {
    rootView: string;
    sharedProps: Record<string, any>;
    version: string | (() => string | Promise<string>);
}

export class InertiaManager {
    private static instance: InertiaManager;
    private sharedProps: Record<string, any> = {};
    private rootView: string = 'root'; // default view name
    private versionData: string | (() => string | Promise<string>) | null = null;
    
    // Per-request sharing storage (using a weak map or similar mechanism in real frameworks,
    // but here we might rely on the middleware attaching an instance to the request)
    // Actually, distinct requests need distinct shared props (e.g. flash messages, auth user).
    // So `share()` should ideally be scoped.
    // For global shared props (e.g. app name), we use this class.
    
    constructor() {}

    public static getInstance(): InertiaManager {
        if (!InertiaManager.instance) {
            InertiaManager.instance = new InertiaManager();
        }
        return InertiaManager.instance;
    }

    /**
     * Set the root view (e.g. 'app' for app.blade.php / app.html)
     */
    public setRootView(view: string) {
        this.rootView = view;
    }
    
    public getRootView(): string {
        return this.rootView;
    }

    /**
     * Share data globally for all requests
     */
    public share(key: string, value: any): void;
    public share(data: Record<string, any>): void;
    public share(keyOrData: string | Record<string, any>, value?: any): void {
        if (typeof keyOrData === 'string') {
            this.sharedProps[keyOrData] = value;
        } else {
            Object.assign(this.sharedProps, keyOrData);
        }
    }

    public getShared(key?: string): any {
        if (key) return this.sharedProps[key];
        return this.sharedProps;
    }
    
    /**
     * Set version
     */
    public version(v: string | (() => string | Promise<string>)) {
        this.versionData = v;
    }
    
    public async getVersion(): Promise<string | undefined> {
        if (!this.versionData) return undefined;
        if (typeof this.versionData === 'function') return await this.versionData();
        return this.versionData;
    }
}

export const inertiaManager = InertiaManager.getInstance();
