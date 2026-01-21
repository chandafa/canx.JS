/**
 * CanxJS OpenAPI/Swagger Generator
 * Auto-generate OpenAPI 3.0 documentation from routes
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';

// ============================================
// Types
// ============================================

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface OpenAPIServer {
  url: string;
  description?: string;
}

export interface OpenAPITag {
  name: string;
  description?: string;
}

export interface OpenAPIConfig {
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  tags?: OpenAPITag[];
  security?: Record<string, string[]>[];
  externalDocs?: {
    description?: string;
    url: string;
  };
}

export interface RouteDoc {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  parameters?: ParameterDoc[];
  requestBody?: RequestBodyDoc;
  responses?: Record<string, ResponseDoc>;
  security?: Record<string, string[]>[];
}

export interface ParameterDoc {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: SchemaDoc;
  example?: unknown;
}

export interface RequestBodyDoc {
  description?: string;
  required?: boolean;
  content: Record<string, { schema: SchemaDoc; example?: unknown }>;
}

export interface ResponseDoc {
  description: string;
  content?: Record<string, { schema: SchemaDoc; example?: unknown }>;
}

export interface SchemaDoc {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaDoc>;
  items?: SchemaDoc;
  required?: string[];
  enum?: unknown[];
  example?: unknown;
  $ref?: string;
  description?: string;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

// ============================================
// OpenAPI Document Builder
// ============================================

export class OpenAPIBuilder {
  private config: OpenAPIConfig;
  private routes: RouteDoc[] = [];
  private schemas: Record<string, SchemaDoc> = {};
  private securitySchemes: Record<string, unknown> = {};

  constructor(config: OpenAPIConfig) {
    this.config = config;
  }

  /**
   * Add a route documentation
   */
  addRoute(doc: RouteDoc): this {
    this.routes.push(doc);
    return this;
  }

  /**
   * Add multiple routes
   */
  addRoutes(docs: RouteDoc[]): this {
    this.routes.push(...docs);
    return this;
  }

  /**
   * Add a schema component
   */
  addSchema(name: string, schema: SchemaDoc): this {
    this.schemas[name] = schema;
    return this;
  }

  /**
   * Add security scheme
   */
  addSecurityScheme(name: string, scheme: {
    type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
    description?: string;
    name?: string;
    in?: 'query' | 'header' | 'cookie';
    scheme?: string;
    bearerFormat?: string;
    flows?: unknown;
  }): this {
    this.securitySchemes[name] = scheme;
    return this;
  }

  /**
   * Add JWT Bearer authentication
   */
  addBearerAuth(name: string = 'bearerAuth'): this {
    this.securitySchemes[name] = {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    };
    return this;
  }

  /**
   * Add API Key authentication
   */
  addApiKeyAuth(name: string = 'apiKey', location: 'header' | 'query' = 'header', keyName: string = 'X-API-Key'): this {
    this.securitySchemes[name] = {
      type: 'apiKey',
      in: location,
      name: keyName,
    };
    return this;
  }

  /**
   * Build the OpenAPI document
   */
  build(): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const route of this.routes) {
      const path = route.path.replace(/:(\w+)/g, '{$1}'); // Convert :id to {id}
      
      if (!paths[path]) {
        paths[path] = {};
      }

      const operation: Record<string, unknown> = {};
      
      if (route.summary) operation.summary = route.summary;
      if (route.description) operation.description = route.description;
      if (route.tags) operation.tags = route.tags;
      if (route.operationId) operation.operationId = route.operationId;
      if (route.deprecated) operation.deprecated = route.deprecated;
      if (route.security) operation.security = route.security;
      
      if (route.parameters && route.parameters.length > 0) {
        operation.parameters = route.parameters.map(p => ({
          name: p.name,
          in: p.in,
          description: p.description,
          required: p.required ?? (p.in === 'path'),
          schema: p.schema || { type: 'string' },
          example: p.example,
        }));
      }
      
      if (route.requestBody) {
        operation.requestBody = route.requestBody;
      }
      
      operation.responses = route.responses || {
        '200': { description: 'Successful response' },
      };

      paths[path][route.method.toLowerCase()] = operation;
    }

    const doc: Record<string, unknown> = {
      openapi: '3.0.0',
      info: this.config.info,
      paths,
    };

    if (this.config.servers && this.config.servers.length > 0) {
      doc.servers = this.config.servers;
    }

    if (this.config.tags && this.config.tags.length > 0) {
      doc.tags = this.config.tags;
    }

    if (this.config.externalDocs) {
      doc.externalDocs = this.config.externalDocs;
    }

    if (this.config.security) {
      doc.security = this.config.security;
    }

    const components: Record<string, unknown> = {};
    
    if (Object.keys(this.schemas).length > 0) {
      components.schemas = this.schemas;
    }
    
    if (Object.keys(this.securitySchemes).length > 0) {
      components.securitySchemes = this.securitySchemes;
    }
    
    if (Object.keys(components).length > 0) {
      doc.components = components;
    }

    return doc;
  }

  /**
   * Get JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }

  /**
   * Get YAML string (basic conversion)
   */
  toYAML(): string {
    return jsonToYaml(this.build());
  }
}

// ============================================
// JSON to YAML converter (simple)
// ============================================

function jsonToYaml(obj: unknown, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (obj === null || obj === undefined) {
    return 'null';
  }
  
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      const value = jsonToYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null) {
        return `\n${spaces}- ${value.trim().split('\n').map((l, i) => i === 0 ? l : `${spaces}  ${l}`).join('\n')}`;
      }
      return `\n${spaces}- ${value}`;
    }).join('');
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries.map(([key, value]) => {
      const yamlValue = jsonToYaml(value, indent + 1);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `${spaces}${key}:\n${yamlValue}`;
      }
      if (Array.isArray(value)) {
        return `${spaces}${key}:${yamlValue}`;
      }
      return `${spaces}${key}: ${yamlValue}`;
    }).join('\n');
  }
  
  return String(obj);
}

// ============================================
// Swagger UI Middleware
// ============================================

const SWAGGER_UI_HTML = (specUrl: string, title: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    }
  </script>
</body>
</html>
`;

/**
 * Create Swagger UI endpoint
 */
export function swaggerUI(specUrl: string, title: string = 'API'): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse) => {
    res.header('Content-Type', 'text/html');
    return res.html(SWAGGER_UI_HTML(specUrl, title));
  };
}

/**
 * Create OpenAPI spec endpoint
 */
export function openAPISpec(builder: OpenAPIBuilder): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse) => {
    return res.json(builder.build());
  };
}

// ============================================
// Route Documentation - Using Map storage
// ============================================

const apiDocStore = new Map<string, Partial<RouteDoc>>();

/**
 * Decorator to add API documentation to route handler
 */
export function ApiDoc(doc: Partial<RouteDoc>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const key = `${target.constructor?.name || 'unknown'}::${propertyKey}`;
    apiDocStore.set(key, doc);
    return descriptor;
  };
}

/**
 * Get API documentation from handler
 */
export function getApiDoc(target: any, propertyKey: string): Partial<RouteDoc> | undefined {
  const key = `${target.constructor?.name || 'unknown'}::${propertyKey}`;
  return apiDocStore.get(key);
}

// ============================================
// Schema Helpers
// ============================================

export const Schemas = {
  string: (opts?: Partial<SchemaDoc>): SchemaDoc => ({ type: 'string', ...opts }),
  number: (opts?: Partial<SchemaDoc>): SchemaDoc => ({ type: 'number', ...opts }),
  integer: (opts?: Partial<SchemaDoc>): SchemaDoc => ({ type: 'integer', ...opts }),
  boolean: (opts?: Partial<SchemaDoc>): SchemaDoc => ({ type: 'boolean', ...opts }),
  array: (items: SchemaDoc, opts?: Partial<SchemaDoc>): SchemaDoc => ({ type: 'array', items, ...opts }),
  object: (properties: Record<string, SchemaDoc>, required?: string[]): SchemaDoc => ({
    type: 'object',
    properties,
    required,
  }),
  ref: (name: string): SchemaDoc => ({ $ref: `#/components/schemas/${name}` }),
  enum: (values: unknown[]): SchemaDoc => ({ enum: values }),
  nullable: (schema: SchemaDoc): SchemaDoc => ({ ...schema, nullable: true }),
};

// ============================================
// Factory
// ============================================

export function createOpenAPI(config: OpenAPIConfig): OpenAPIBuilder {
  return new OpenAPIBuilder(config);
}
