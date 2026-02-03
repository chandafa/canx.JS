/**
 * CanxJS View - Native JSX rendering engine for Bun
 */

import type { LayoutProps } from '../types';
import { ViewNotFoundException } from '../core/exceptions/ViewNotFoundException';

// Fragment symbol for JSX
export const Fragment = Symbol.for('canxjs.fragment');

// Void elements that should not have closing tags
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

// JSX Factory functions for Bun's native JSX support
// Safe HTML String wrapper
export class SafeString extends String {
  toString(): string {
    return super.toString();
  }
}

// Helper to mark string as safe (e.g. from other components)
export function raw(str: string): SafeString {
  return new SafeString(str);
}

// JSX Factory functions
export const jsx = (
  tag: string | Function | symbol,
  props: Record<string, any> | null
): SafeString => {
  // 1. Handle Fragment
  if (tag === Fragment || (typeof tag === 'symbol' && tag.description === 'canxjs.fragment')) {
    return new SafeString(processChildren(props?.children));
  }

  // 2. Handle Components (Functions)
  if (typeof tag === 'function') {
    const res = tag(props || {});
    // Ensure result is SafeString
    return res instanceof SafeString ? res : new SafeString(String(res));
  }

  // 3. Handle Native Elements
  const tagName = tag as string;
  let attrs = '';

  if (props) {
    // ... (attribute logic remains same, it already escapes)
    const attrList: string[] = [];
    
    for (const key in props) {
      if (key === 'children') continue;

      if (!/^[a-zA-Z0-9-_\:]+$/.test(key)) continue;

      const value = props[key];

      if (key === 'className') {
        if (value) attrList.push(`class="${escapeHtml(String(value))}"`);
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
        if (value) attrList.push(key);
        continue;
      }

      if (value === null || value === undefined) continue;
      if (key.startsWith('on') && typeof value === 'function') continue;
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
  } else {
      childrenHtml = processChildren(props?.children);
  }

  if (VOID_ELEMENTS.has(tagName)) {
    return new SafeString(`<${tagName}${attrs} />`);
  }

  return new SafeString(`<${tagName}${attrs}>${childrenHtml}</${tagName}>`);
};

export const jsxs = jsx;

function processChildren(children: any): string {
  if (children === null || children === undefined || children === false || children === true) return '';
  
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

function escapeHtml(str: string): string {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// HTML layout helper
export function html(content: string, options: { title?: string; lang?: string; meta?: Record<string, string>; head?: string } = {}): string {
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
export function createLayout(layout: (props: LayoutProps) => string) {
  return (content: string, props: Omit<LayoutProps, 'children'> = {}) => {
    return layout({ ...props, children: content as any });
  };
}

// Render JSX to string
export function render(component: string | (() => string)): string {
  return typeof component === 'function' ? component() : component;
}

// Render with full HTML document
export function renderPage(component: string | (() => string), options?: { title?: string; meta?: Record<string, string>; head?: string }): string {
  return html(render(component), options);
}

// Helper to render a View with props
export function View(component: any, props: Record<string, any> = {}): string {
  // If component is a function (functional component), call it with props
  if (typeof component === 'function') {
      try {
          const result = component(props);
          return renderPage(() => result);
      } catch (e) {
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
export async function view(
  name: string, 
  props: Record<string, any> = {},
  options?: { title?: string; meta?: Record<string, string>; head?: string }
): Promise<string> {
  // Convert dot notation to path
  const viewPath = name.replace(/\./g, '/');
  
  // Possible view file extensions and paths
  const extensions = ['.tsx', '.jsx', '.ts', '.js'];
  const basePaths = [
    process.cwd() + '/views',
    process.cwd() + '/src/views',
    process.cwd() + '/resources/views',
  ];
  
  const searchedPaths: string[] = [];
  
  // Try to find the view file
  for (const base of basePaths) {
    for (const ext of extensions) {
      const fullPath = `${base}/${viewPath}${ext}`;
      searchedPaths.push(fullPath);
      
      try {
        const file = Bun.file(fullPath);
        if (await file.exists()) {
          // Dynamic import the view file
          const viewModule = await import(fullPath);
          const ViewComponent = viewModule.default || viewModule[Object.keys(viewModule)[0]];
          
          if (typeof ViewComponent === 'function') {
            const result = ViewComponent(props);
            return renderPage(() => result, options);
          } else if (typeof ViewComponent === 'string') {
            return renderPage(() => ViewComponent, options);
          }
        }
      } catch (error) {
        // Continue to next path
        continue;
      }
    }
  }
  
  // View not found - throw exception
  throw new ViewNotFoundException(name, searchedPaths);
}

/**
 * Check if a view exists
 * 
 * @param name - View name using dot notation
 * @returns true if view exists, false otherwise
 */
export async function viewExists(name: string): Promise<boolean> {
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

/**
 * Check if a view exists and render it if so
 */
export async function viewIfExists(
  name: string,
  props: Record<string, any> = {},
  options?: { title?: string; meta?: Record<string, string>; head?: string }
): Promise<string | null> {
    if (await viewExists(name)) {
        return await view(name, props, options);
    }
    return null;
}

export default { jsx, jsxs, Fragment, html, render, renderPage, createLayout, View, view, viewExists, viewIfExists };

