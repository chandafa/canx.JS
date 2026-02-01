"use strict";
/**
 * CanxJS View - Native JSX rendering engine for Bun
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsxs = exports.jsx = exports.SafeString = exports.Fragment = void 0;
exports.raw = raw;
exports.html = html;
exports.createLayout = createLayout;
exports.render = render;
exports.renderPage = renderPage;
exports.View = View;
exports.view = view;
exports.viewExists = viewExists;
const ViewNotFoundException_1 = require("../core/exceptions/ViewNotFoundException");
// Fragment symbol for JSX
exports.Fragment = Symbol.for('canxjs.fragment');
// Void elements that should not have closing tags
const VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]);
// JSX Factory functions for Bun's native JSX support
// Safe HTML String wrapper
class SafeString extends String {
    toString() {
        return super.toString();
    }
}
exports.SafeString = SafeString;
// Helper to mark string as safe (e.g. from other components)
function raw(str) {
    return new SafeString(str);
}
// JSX Factory functions
const jsx = (tag, props) => {
    // 1. Handle Fragment
    if (tag === exports.Fragment || (typeof tag === 'symbol' && tag.description === 'canxjs.fragment')) {
        return new SafeString(processChildren(props?.children));
    }
    // 2. Handle Components (Functions)
    if (typeof tag === 'function') {
        const res = tag(props || {});
        // Ensure result is SafeString
        return res instanceof SafeString ? res : new SafeString(String(res));
    }
    // 3. Handle Native Elements
    const tagName = tag;
    let attrs = '';
    if (props) {
        // ... (attribute logic remains same, it already escapes)
        const attrList = [];
        for (const key in props) {
            if (key === 'children')
                continue;
            if (!/^[a-zA-Z0-9-_\:]+$/.test(key))
                continue;
            const value = props[key];
            if (key === 'className') {
                if (value)
                    attrList.push(`class="${escapeHtml(String(value))}"`);
                continue;
            }
            if (key === 'dangerouslySetInnerHTML' && value?.__html) {
                // Special React-like handling, we don't render it as attr, we handle it in children? 
                // Actually native elements with dangerouslySetInnerHTML usually mean "content is this".
                // We will handle it later or ignore? 
                // Let's implement it for compatibility.
                // It overrides children.
                continue;
            }
            if (key === 'style' && typeof value === 'object') {
                attrList.push(`style="${Object.entries(value).map(([k, v]) => `${k}:${v}`).join(';')}"`);
                continue;
            }
            if (typeof value === 'boolean') {
                if (value)
                    attrList.push(key);
                continue;
            }
            if (value === null || value === undefined)
                continue;
            if (key.startsWith('on') && typeof value === 'function')
                continue;
            if (key.startsWith('on') && typeof value === 'string') {
                attrList.push(`${key}="${escapeHtml(value)}"`);
                continue;
            }
            attrList.push(`${key}="${escapeHtml(String(value))}"`);
        }
        if (attrList.length > 0) {
            attrs = ' ' + attrList.join(' ');
        }
    }
    // Handle dangerouslySetInnerHTML
    let childrenHtml = '';
    if (props?.dangerouslySetInnerHTML?.__html) {
        childrenHtml = props.dangerouslySetInnerHTML.__html;
    }
    else {
        childrenHtml = processChildren(props?.children);
    }
    if (VOID_ELEMENTS.has(tagName)) {
        return new SafeString(`<${tagName}${attrs} />`);
    }
    return new SafeString(`<${tagName}${attrs}>${childrenHtml}</${tagName}>`);
};
exports.jsx = jsx;
exports.jsxs = exports.jsx;
function processChildren(children) {
    if (children === null || children === undefined || children === false || children === true)
        return '';
    if (Array.isArray(children)) {
        return children.map(processChildren).join('');
    }
    // Critical Security Check
    if (children instanceof SafeString) {
        return children.toString();
    }
    // It's a plain string/number -> Escape it
    return escapeHtml(String(children));
}
function escapeHtml(str) {
    if (typeof str !== 'string')
        return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
// HTML layout helper
function html(content, options = {}) {
    const { title = 'CanxJS App', lang = 'en', meta = {}, head = '' } = options;
    const metaTags = Object.entries(meta).map(([name, content]) => `<meta name="${name}" content="${content}">`).join('\n    ');
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${metaTags}
    ${head}
</head>
<body>
    ${content}
</body>
</html>`;
}
// Layout component factory
function createLayout(layout) {
    return (content, props = {}) => {
        return layout({ ...props, children: content });
    };
}
// Render JSX to string
function render(component) {
    return typeof component === 'function' ? component() : component;
}
// Render with full HTML document
function renderPage(component, options) {
    return html(render(component), options);
}
// Helper to render a View with props
function View(component, props = {}) {
    // If component is a function (functional component), call it with props
    if (typeof component === 'function') {
        try {
            const result = component(props);
            return renderPage(() => result);
        }
        catch (e) {
            // Fallback if it's already a string or something else
            return renderPage(() => String(component));
        }
    }
    return renderPage(() => String(component));
}
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
async function view(name, props = {}, options) {
    // Convert dot notation to path
    const viewPath = name.replace(/\./g, '/');
    // Possible view file extensions and paths
    const extensions = ['.tsx', '.jsx', '.ts', '.js'];
    const basePaths = [
        process.cwd() + '/views',
        process.cwd() + '/src/views',
        process.cwd() + '/resources/views',
    ];
    const searchedPaths = [];
    // Try to find the view file
    for (const base of basePaths) {
        for (const ext of extensions) {
            const fullPath = `${base}/${viewPath}${ext}`;
            searchedPaths.push(fullPath);
            try {
                const file = Bun.file(fullPath);
                if (await file.exists()) {
                    // Dynamic import the view file
                    const viewModule = await Promise.resolve(`${fullPath}`).then(s => __importStar(require(s)));
                    const ViewComponent = viewModule.default || viewModule[Object.keys(viewModule)[0]];
                    if (typeof ViewComponent === 'function') {
                        const result = ViewComponent(props);
                        return renderPage(() => result, options);
                    }
                    else if (typeof ViewComponent === 'string') {
                        return renderPage(() => ViewComponent, options);
                    }
                }
            }
            catch (error) {
                // Continue to next path
                continue;
            }
        }
    }
    // View not found - throw exception
    throw new ViewNotFoundException_1.ViewNotFoundException(name, searchedPaths);
}
/**
 * Check if a view exists
 *
 * @param name - View name using dot notation
 * @returns true if view exists, false otherwise
 */
async function viewExists(name) {
    const viewPath = name.replace(/\./g, '/');
    const extensions = ['.tsx', '.jsx', '.ts', '.js'];
    const basePaths = [
        process.cwd() + '/views',
        process.cwd() + '/src/views',
        process.cwd() + '/resources/views',
    ];
    for (const base of basePaths) {
        for (const ext of extensions) {
            const fullPath = `${base}/${viewPath}${ext}`;
            const file = Bun.file(fullPath);
            if (await file.exists()) {
                return true;
            }
        }
    }
    return false;
}
exports.default = { jsx: exports.jsx, jsxs: exports.jsxs, Fragment: exports.Fragment, html, render, renderPage, createLayout, View, view, viewExists };
