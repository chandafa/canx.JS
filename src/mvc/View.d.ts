/**
 * CanxJS View - Native JSX rendering engine for Bun
 */
import type { LayoutProps } from '../types';
export declare const Fragment: unique symbol;
export declare class SafeString extends String {
    toString(): string;
}
export declare function raw(str: string): SafeString;
export declare const jsx: (tag: string | Function | symbol, props: Record<string, any> | null) => SafeString;
export declare const jsxs: (tag: string | Function | symbol, props: Record<string, any> | null) => SafeString;
export declare function html(content: string, options?: {
    title?: string;
    lang?: string;
    meta?: Record<string, string>;
    head?: string;
}): string;
export declare function createLayout(layout: (props: LayoutProps) => string): (content: string, props?: Omit<LayoutProps, "children">) => string;
export declare function render(component: string | (() => string)): string;
export declare function renderPage(component: string | (() => string), options?: {
    title?: string;
    meta?: Record<string, string>;
    head?: string;
}): string;
export declare function View(component: any, props?: Record<string, any>): string;
/**
 * Load and render a view file by name
 * Similar to Laravel's view() helper
 *
 * @param name - View name using dot notation (e.g., 'pages.home', 'auth.login')
 * @param props - Data to pass to the view
 * @param options - Render options
 * @returns Rendered HTML string
 *
 * @example
 * // Load views/pages/home.tsx
 * return await view('pages.home', { title: 'Welcome' });
 *
 * // Load views/auth/login.tsx
 * return await view('auth.login', { error: null });
 */
export declare function view(name: string, props?: Record<string, any>, options?: {
    title?: string;
    meta?: Record<string, string>;
    head?: string;
}): Promise<string>;
/**
 * Check if a view exists
 *
 * @param name - View name using dot notation
 * @returns true if view exists, false otherwise
 */
export declare function viewExists(name: string): Promise<boolean>;
declare const _default: {
    jsx: (tag: string | Function | symbol, props: Record<string, any> | null) => SafeString;
    jsxs: (tag: string | Function | symbol, props: Record<string, any> | null) => SafeString;
    Fragment: symbol;
    html: typeof html;
    render: typeof render;
    renderPage: typeof renderPage;
    createLayout: typeof createLayout;
    View: typeof View;
    view: typeof view;
    viewExists: typeof viewExists;
};
export default _default;
