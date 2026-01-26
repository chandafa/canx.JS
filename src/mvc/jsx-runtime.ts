import { jsx, jsxs, Fragment } from './View';

export { jsx, jsxs, Fragment };
export { jsx as jsxDEV };

export namespace JSX {
  // The return type of our JSX factory
  export interface Element extends String { }

  // The element class, used for class components (not really used in our static model)
  export interface ElementClass {
    render(): string;
  }

  export interface ElementAttributesProperty {
    props: {};
  }

  export interface ElementChildrenAttribute {
    children: {};
  }

  // Intrinsic elements (HTML tags)
  export interface IntrinsicElements {
    [elemName: string]: any;
  }
}

// Canx Namespace for more specific types if needed
export namespace Canx {
  export type Node = string | number | boolean | null | undefined | Node[];
  export type Element = string;
}
