/**
 * CanxJS View - Native JSX rendering engine for Bun
 */

import type { LayoutProps } from '../types';

// Fragment symbol for JSX
export const Fragment = Symbol.for('canxjs.fragment');

// JSX Factory functions for Bun's native JSX support
// Note: In react-jsx mode, children are passed in props.children, not as rest params
export const jsx = (
  type: string | Function | symbol,
  props: Record<string, any> | null
): string => {
  // Handle Fragment
  if (type === Fragment || (typeof type === 'symbol' && type.description === 'canxjs.fragment')) {
    const children = props?.children;
    if (Array.isArray(children)) {
      return children.flat().map(c => (c === null || c === undefined || c === false) ? '' : String(c)).join('');
    }
    return children ? String(children) : '';
  }
  
  // Handle functional components
  if (typeof type === 'function') {
    return type(props || {});
  }

  // At this point type should be a string (HTML tag)
  const tagName = type as string;
  const children = props?.children;
  const attrs = props
    ? Object.entries(props)
        .filter(([key]) => key !== 'children')
        .map(([key, val]) => {
          if (key === 'className') key = 'class';
          if (typeof val === 'boolean') return val ? key : '';
          if (val === null || val === undefined) return '';
          return `${key}="${escapeHtml(String(val))}"`;
        })
        .filter(Boolean)
        .join(' ')
    : '';

  // Process children
  let content = '';
  if (children !== null && children !== undefined) {
    if (Array.isArray(children)) {
      content = children.flat().map(c => (c === null || c === undefined || c === false) ? '' : String(c)).join('');
    } else if (children !== false) {
      content = String(children);
    }
  }

  // Self-closing tags
  const selfClosing = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'];
  if (selfClosing.includes(tagName)) {
    return `<${tagName}${attrs ? ' ' + attrs : ''} />`;
  }

  return `<${tagName}${attrs ? ' ' + attrs : ''}>${content}</${tagName}>`;
};

export const jsxs = jsx;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

export default { jsx, jsxs, Fragment, html, render, renderPage, createLayout, View };
