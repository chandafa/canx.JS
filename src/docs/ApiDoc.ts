/**
 * CanxJS API Documentation - Auto-generate Swagger/OpenAPI
 */

interface ApiEndpoint {
  method: string;
  path: string;
  tag?: string;
  summary?: string;
  description?: string;
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses?: Record<string, ApiResponse>;
  security?: string[];
}

interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: ApiSchema;
  description?: string;
}

interface ApiRequestBody {
  required?: boolean;
  content: Record<string, { schema: ApiSchema }>;
}

interface ApiResponse {
  description: string;
  content?: Record<string, { schema: ApiSchema }>;
}

interface ApiSchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  properties?: Record<string, ApiSchema>;
  items?: ApiSchema;
  required?: string[];
  example?: unknown;
  enum?: unknown[];
  format?: string;
}

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, ApiSchema>; securitySchemes?: Record<string, unknown> };
  tags?: Array<{ name: string; description?: string }>;
}

// ============================================
// Decorators for API Documentation
// ============================================

const apiMetadata = new WeakMap<object, Map<string, ApiEndpoint>>();

export function ApiDoc(meta: Partial<ApiEndpoint>): MethodDecorator {
  return (target: any, propertyKey: string | symbol) => {
    if (!apiMetadata.has(target)) {
      apiMetadata.set(target, new Map());
    }
    const existing = apiMetadata.get(target)!.get(String(propertyKey)) || {};
    apiMetadata.get(target)!.set(String(propertyKey), { ...existing, ...meta } as ApiEndpoint);
  };
}

export function ApiParam(param: ApiParameter): MethodDecorator {
  return (target: any, propertyKey: string | symbol) => {
    if (!apiMetadata.has(target)) apiMetadata.set(target, new Map());
    const meta = apiMetadata.get(target)!;
    const existing = meta.get(String(propertyKey)) || {} as ApiEndpoint;
    existing.parameters = [...(existing.parameters || []), param];
    meta.set(String(propertyKey), existing);
  };
}

import { Schema } from '../schema/Schema';

export function ApiBody(schema: ApiSchema | Schema<any>, required = true): MethodDecorator {
  return (target: any, propertyKey: string | symbol) => {
    if (!apiMetadata.has(target)) apiMetadata.set(target, new Map());
    const meta = apiMetadata.get(target)!;
    const existing = meta.get(String(propertyKey)) || {} as ApiEndpoint;
    
    const finalSchema = schema instanceof Schema ? schema.getJsonSchema() : schema;
    
    existing.requestBody = { required, content: { 'application/json': { schema: finalSchema as ApiSchema } } };
    meta.set(String(propertyKey), existing);
  };
}

export function ApiResponse(status: number, description: string, schema?: ApiSchema | Schema<any>): MethodDecorator {
  return (target: any, propertyKey: string | symbol) => {
    if (!apiMetadata.has(target)) apiMetadata.set(target, new Map());
    const meta = apiMetadata.get(target)!;
    const existing = meta.get(String(propertyKey)) || {} as ApiEndpoint;
    existing.responses = existing.responses || {};
    
    const finalSchema = schema instanceof Schema ? schema.getJsonSchema() : schema;

    existing.responses[String(status)] = {
      description,
      content: finalSchema ? { 'application/json': { schema: finalSchema as ApiSchema } } : undefined,
    };
    meta.set(String(propertyKey), existing);
  };
}

// ============================================
// API Documentation Generator
// ============================================

class ApiDocGenerator {
  private endpoints: ApiEndpoint[] = [];
  private schemas: Record<string, ApiSchema> = {};
  private tags: Set<string> = new Set();

  addEndpoint(endpoint: ApiEndpoint): void {
    this.endpoints.push(endpoint);
    if (endpoint.tag) this.tags.add(endpoint.tag);
  }

  addSchema(name: string, schema: ApiSchema): void {
    this.schemas[name] = schema;
  }

  generate(info: { title: string; version: string; description?: string }, servers?: Array<{ url: string }>): OpenAPISpec {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const endpoint of this.endpoints) {
      if (!paths[endpoint.path]) paths[endpoint.path] = {};
      
      const operation: Record<string, unknown> = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tag ? [endpoint.tag] : undefined,
        parameters: endpoint.parameters,
        requestBody: endpoint.requestBody,
        responses: endpoint.responses || { '200': { description: 'Success' } },
      };

      if (endpoint.security?.length) {
        operation.security = endpoint.security.map(s => ({ [s]: [] }));
      }

      paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
    }

    return {
      openapi: '3.0.3',
      info,
      servers,
      paths,
      components: {
        schemas: Object.keys(this.schemas).length ? this.schemas : undefined,
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: Array.from(this.tags).map(name => ({ name })),
    };
  }

  /**
   * Generate Swagger UI HTML
   */
  generateHTML(spec: OpenAPISpec): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>${spec.info.title} - API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      spec: ${JSON.stringify(spec)},
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "StandaloneLayout"
    });
  </script>
</body>
</html>`;
  }
}

export const apiDoc = new ApiDocGenerator();

/**
 * Middleware to serve API documentation
 */
export function serveApiDocs(
  path: string,
  info: { title: string; version: string; description?: string }
) {
  return {
    json: `${path}/openapi.json`,
    ui: path,
    handler: (req: any, res: any) => {
      const url = new URL(req.raw.url);
      const spec = apiDoc.generate(info, [{ url: url.origin }]);
      
      if (url.pathname === `${path}/openapi.json`) {
        return res.json(spec);
      }
      return res.html(apiDoc.generateHTML(spec));
    },
  };
}

export { ApiDocGenerator };
export default apiDoc;
