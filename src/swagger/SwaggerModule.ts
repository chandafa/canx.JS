/**
 * CanxJS Swagger Module
 * OpenAPI 3.0 spec builder and Swagger UI integration
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';
import { getControllerMeta } from '../mvc/Controller';
import {
  getApiMetadataByName,
  getAllApiMetadata,
  getSchemaDefinitions,
  type ApiMetadata,
  type SchemaObject,
  type SecurityRequirement,
} from './decorators';

// ============================================
// Types & Interfaces
// ============================================

export interface SwaggerConfig {
  /** API title */
  title: string;
  /** API description */
  description?: string;
  /** API version */
  version: string;
  /** Terms of service URL */
  termsOfService?: string;
  /** Contact info */
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  /** License info */
  license?: {
    name: string;
    url?: string;
  };
  /** Server URLs */
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  /** External documentation */
  externalDocs?: {
    description?: string;
    url: string;
  };
  /** Tag definitions */
  tags?: Array<{
    name: string;
    description?: string;
    externalDocs?: {
      description?: string;
      url: string;
    };
  }>;
  /** Security schemes */
  securitySchemes?: Record<string, SecurityScheme>;
  /** Global security requirements */
  security?: SecurityRequirement[];
  /** Base path for API */
  basePath?: string;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
    termsOfService?: string;
    contact?: { name?: string; email?: string; url?: string };
    license?: { name: string; url?: string };
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  tags?: Array<{ name: string; description?: string }>;
  externalDocs?: { description?: string; url: string };
  security?: SecurityRequirement[];
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
}

export interface OperationObject {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  security?: SecurityRequirement[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
}

export interface ParameterObject {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: unknown;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, { schema?: SchemaObject; example?: unknown }>;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, { schema?: SchemaObject; example?: unknown }>;
  headers?: Record<string, { description?: string; schema?: SchemaObject }>;
}

// ============================================
// Swagger Document Builder
// ============================================

export class SwaggerDocumentBuilder {
  private config: SwaggerConfig;
  private controllers: any[] = [];
  private additionalSchemas: Record<string, SchemaObject> = {};

  constructor(config: SwaggerConfig) {
    this.config = config;
  }

  /**
   * Add controllers to document
   */
  addControllers(...controllers: any[]): this {
    this.controllers.push(...controllers);
    return this;
  }

  /**
   * Add custom schema definitions
   */
  addSchema(name: string, schema: SchemaObject): this {
    this.additionalSchemas[name] = schema;
    return this;
  }

  /**
   * Add bearer auth security scheme
   */
  addBearerAuth(options: { description?: string; bearerFormat?: string } = {}): this {
    this.config.securitySchemes = this.config.securitySchemes || {};
    this.config.securitySchemes['bearer'] = {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: options.bearerFormat || 'JWT',
      description: options.description || 'JWT Authorization',
    };
    return this;
  }

  /**
   * Add API key security scheme
   */
  addApiKey(options: { name?: string; in?: 'header' | 'query'; description?: string } = {}): this {
    this.config.securitySchemes = this.config.securitySchemes || {};
    this.config.securitySchemes['apiKey'] = {
      type: 'apiKey',
      name: options.name || 'X-API-Key',
      in: options.in || 'header',
      description: options.description || 'API Key Authentication',
    };
    return this;
  }

  /**
   * Add basic auth security scheme
   */
  addBasicAuth(options: { description?: string } = {}): this {
    this.config.securitySchemes = this.config.securitySchemes || {};
    this.config.securitySchemes['basic'] = {
      type: 'http',
      scheme: 'basic',
      description: options.description || 'Basic HTTP Authentication',
    };
    return this;
  }

  /**
   * Add OAuth2 security scheme
   */
  addOAuth2(flows: OAuthFlows, options: { description?: string } = {}): this {
    this.config.securitySchemes = this.config.securitySchemes || {};
    this.config.securitySchemes['oauth2'] = {
      type: 'oauth2',
      flows,
      description: options.description,
    };
    return this;
  }

  /**
   * Add global security requirement
   */
  addSecurityRequirement(requirement: SecurityRequirement): this {
    this.config.security = this.config.security || [];
    this.config.security.push(requirement);
    return this;
  }

  /**
   * Add server
   */
  addServer(url: string, description?: string): this {
    this.config.servers = this.config.servers || [];
    this.config.servers.push({ url, description });
    return this;
  }

  /**
   * Add tag
   */
  addTag(name: string, description?: string): this {
    this.config.tags = this.config.tags || [];
    this.config.tags.push({ name, description });
    return this;
  }

  /**
   * Build OpenAPI document
   */
  build(): OpenAPIDocument {
    const paths: Record<string, PathItem> = {};
    const schemas: Record<string, SchemaObject> = { ...this.additionalSchemas };
    const usedTags = new Set<string>();

    // Process registered schemas
    for (const [name, schema] of getSchemaDefinitions()) {
      schemas[name] = schema;
    }

    // Process controllers
    for (const controller of this.controllers) {
      const controllerClass = typeof controller === 'function' ? controller : controller.constructor;
      const controllerName = controllerClass.name;
      const controllerMeta = getControllerMeta(controllerClass.prototype);
      const apiMeta = getApiMetadataByName(controllerName);

      const basePath = controllerMeta.prefix || '';
      const controllerTags = apiMeta?.controller?.tags || [];
      const controllerSecurity = apiMeta?.controller?.security;

      // Add controller tags
      controllerTags.forEach(tag => usedTags.add(tag));

      // Process routes
      for (const [methodName, routeMeta] of controllerMeta.routes) {
        const methodApiMeta = apiMeta?.methods.get(methodName);
        
        // Skip excluded endpoints
        if ((methodApiMeta as any)?.excluded) continue;

        const fullPath = this.normalizePath(basePath + routeMeta.path);
        const method = routeMeta.method.toLowerCase();

        // Extract path parameters from path
        const pathParams = this.extractPathParams(fullPath);

        // Build operation
        const operation: OperationObject = {
          summary: methodApiMeta?.summary,
          description: methodApiMeta?.description,
          operationId: methodApiMeta?.operationId || `${controllerName}_${methodName}`,
          deprecated: methodApiMeta?.deprecated,
          tags: methodApiMeta?.tags || controllerTags,
          security: methodApiMeta?.security || controllerSecurity,
          parameters: [
            // Path parameters
            ...pathParams.map(name => ({
              name,
              in: 'path' as const,
              required: true,
              schema: { type: 'string' as const },
            })),
            // Documented parameters
            ...(methodApiMeta?.parameters || []),
          ],
          requestBody: methodApiMeta?.requestBody,
          responses: methodApiMeta?.responses.size 
            ? Object.fromEntries(methodApiMeta.responses)
            : { '200': { description: 'Successful response' } },
        };

        // Add to paths
        if (!paths[fullPath]) {
          paths[fullPath] = {};
        }
        (paths[fullPath] as any)[method] = operation;
      }
    }

    // Build tags from used tags
    const tags = [...usedTags].map(name => {
      const existing = this.config.tags?.find(t => t.name === name);
      return existing || { name };
    });

    // Build document
    const doc: OpenAPIDocument = {
      openapi: '3.0.3',
      info: {
        title: this.config.title,
        description: this.config.description,
        version: this.config.version,
        termsOfService: this.config.termsOfService,
        contact: this.config.contact,
        license: this.config.license,
      },
      servers: this.config.servers || [{ url: '/' }],
      paths,
      components: {
        schemas: Object.keys(schemas).length > 0 ? schemas : undefined,
        securitySchemes: this.config.securitySchemes,
      },
      tags: tags.length > 0 ? tags : undefined,
      externalDocs: this.config.externalDocs,
      security: this.config.security,
    };

    return doc;
  }

  private normalizePath(path: string): string {
    // Convert :param to {param}
    return path.replace(/:(\w+)/g, '{$1}').replace(/\/+/g, '/');
  }

  private extractPathParams(path: string): string[] {
    const matches = path.match(/\{(\w+)\}/g) || [];
    return matches.map(m => m.slice(1, -1));
  }
}

// ============================================
// Swagger Module
// ============================================

export class SwaggerModule {
  private static document: OpenAPIDocument | null = null;
  private static config: SwaggerUIConfig = {};

  /**
   * Create OpenAPI document
   */
  static createDocument(config: SwaggerConfig, controllers: any[]): OpenAPIDocument {
    const builder = new SwaggerDocumentBuilder(config);
    builder.addControllers(...controllers);
    this.document = builder.build();
    return this.document;
  }

  /**
   * Setup Swagger UI route
   */
  static setup(
    path: string = '/api-docs',
    document: OpenAPIDocument,
    options: SwaggerUIConfig = {}
  ): { 
    uiHandler: MiddlewareHandler; 
    jsonHandler: MiddlewareHandler;
    setupRoutes: (router: any) => void;
  } {
    this.document = document;
    this.config = options;

    const uiHandler: MiddlewareHandler = async (req: CanxRequest, res: CanxResponse) => {
      const html = this.generateSwaggerUI(path);
      return res.html(html);
    };

    const jsonHandler: MiddlewareHandler = async (req: CanxRequest, res: CanxResponse) => {
      return res.json(document);
    };

    const setupRoutes = (router: any) => {
      router.get(path, uiHandler);
      router.get(`${path}/json`, jsonHandler);
      router.get(`${path}/swagger.json`, jsonHandler);
    };

    return { uiHandler, jsonHandler, setupRoutes };
  }

  /**
   * Get middleware handler for Swagger UI
   */
  static getUIMiddleware(options: SwaggerUIConfig = {}): MiddlewareHandler {
    return async (req: CanxRequest, res: CanxResponse) => {
      if (!this.document) {
        return res.status(500).json({ error: 'Swagger document not initialized' });
      }
      const html = this.generateSwaggerUI('/api-docs', options);
      return res.html(html);
    };
  }

  /**
   * Get middleware handler for OpenAPI JSON
   */
  static getJSONMiddleware(): MiddlewareHandler {
    return async (req: CanxRequest, res: CanxResponse) => {
      if (!this.document) {
        return res.status(500).json({ error: 'Swagger document not initialized' });
      }
      return res.json(this.document);
    };
  }

  /**
   * Generate Swagger UI HTML
   */
  private static generateSwaggerUI(basePath: string, config: SwaggerUIConfig = {}): string {
    const title = this.document?.info.title || 'API Documentation';
    const jsonUrl = `${basePath}/json`;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: ${config.customSiteTitle ? '#fafafa' : '#fafafa'}; }
    .swagger-ui .topbar { display: ${config.customSiteTitle === false ? 'block' : 'none'}; }
    ${config.customCss || ''}
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "${jsonUrl}",
        dom_id: '#swagger-ui',
        deepLinking: ${config.deepLinking ?? true},
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        docExpansion: "${config.docExpansion || 'list'}",
        filter: ${config.filter ?? true},
        showExtensions: ${config.showExtensions ?? true},
        showCommonExtensions: ${config.showCommonExtensions ?? true},
        tryItOutEnabled: ${config.tryItOutEnabled ?? true},
        persistAuthorization: ${config.persistAuthorization ?? true},
        ${config.validatorUrl !== undefined ? `validatorUrl: ${config.validatorUrl === null ? 'null' : `"${config.validatorUrl}"`},` : ''}
      });
      window.ui = ui;
    };
  </script>
</body>
</html>`;
  }
}

// ============================================
// Swagger UI Configuration
// ============================================

export interface SwaggerUIConfig {
  /** Custom CSS styles */
  customCss?: string;
  /** Custom site title */
  customSiteTitle?: string | false;
  /** Custom favicon URLs */
  customfavIcon?: string;
  /** URL for schema validation */
  validatorUrl?: string | null;
  /** Default models expansion depth */
  defaultModelsExpandDepth?: number;
  /** Default model expand depth */
  defaultModelExpandDepth?: number;
  /** Doc expansion mode */
  docExpansion?: 'none' | 'list' | 'full';
  /** Enable filter */
  filter?: boolean;
  /** Show extensions  */
  showExtensions?: boolean;
  /** Show common extensions */
  showCommonExtensions?: boolean;
  /** Deep linking */
  deepLinking?: boolean;
  /** Try it out enabled */
  tryItOutEnabled?: boolean;
  /** Persist authorization */
  persistAuthorization?: boolean;
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a Swagger document builder
 */
export function createSwaggerDocument(config: SwaggerConfig): SwaggerDocumentBuilder {
  return new SwaggerDocumentBuilder(config);
}

/**
 * Setup Swagger with simple configuration
 */
export function setupSwagger(
  router: any,
  options: {
    path?: string;
    config: SwaggerConfig;
    controllers: any[];
    uiConfig?: SwaggerUIConfig;
  }
): OpenAPIDocument {
  const { path = '/api-docs', config, controllers, uiConfig } = options;
  
  const document = SwaggerModule.createDocument(config, controllers);
  const { setupRoutes } = SwaggerModule.setup(path, document, uiConfig);
  setupRoutes(router);
  
  return document;
}

// ============================================
// Exports
// ============================================

export { 
  // Re-export decorators
  ApiTags,
  ApiBearerAuth,
  ApiKeyAuth,
  ApiBasicAuth,
  ApiOAuth2,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiAcceptedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiUnprocessableEntityResponse,
  ApiInternalServerErrorResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBody,
  ApiProperty,
  ApiPropertyOptional,
  ApiHideProperty,
  ApiExcludeEndpoint,
  ApiExcludeController,
  ApiProduces,
  ApiConsumes,
  getApiMetadata,
  getAllApiMetadata,
  getSchemaDefinitions,
  buildSchemaFromType,
} from './decorators';
