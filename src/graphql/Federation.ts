/**
 * CanxJS GraphQL Federation Module
 * Apollo Federation support for microservices
 */

import type { MiddlewareHandler, CanxRequest, CanxResponse } from '../types';

// ============================================
// Types & Interfaces
// ============================================

export interface FederationOptions {
  /** Service name */
  name: string;
  /** GraphQL type definitions */
  typeDefs: string;
  /** Resolver functions */
  resolvers: Record<string, any>;
  /** GraphQL endpoint path */
  path?: string;
  /** Enable GraphiQL */
  graphiql?: boolean;
  /** Context factory */
  context?: (ctx: { req: CanxRequest; res: CanxResponse }) => any | Promise<any>;
}

export interface FederatedServiceConfig {
  name: string;
  url: string;
}

export interface GatewayOptions {
  /** List of federated services */
  services: FederatedServiceConfig[];
  /** Polling interval for schema updates (ms) */
  pollInterval?: number;
  /** Enable introspection */
  introspection?: boolean;
  /** GraphQL endpoint path */
  path?: string;
  /** Context factory */
  context?: (ctx: { req: CanxRequest; res: CanxResponse }) => any | Promise<any>;
}

// ============================================
// Federation Directives
// ============================================

export const federationDirectives = `
  scalar _Any
  scalar _FieldSet
  
  union _Entity
  
  type _Service {
    sdl: String
  }
  
  directive @external on FIELD_DEFINITION
  directive @requires(fields: _FieldSet!) on FIELD_DEFINITION
  directive @provides(fields: _FieldSet!) on FIELD_DEFINITION
  directive @key(fields: _FieldSet!) on OBJECT | INTERFACE
  directive @extends on OBJECT | INTERFACE
  directive @shareable on OBJECT | FIELD_DEFINITION
  directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION
  directive @override(from: String!) on FIELD_DEFINITION
  directive @tag(name: String!) repeatable on FIELD_DEFINITION | INTERFACE | OBJECT | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION
`;

// ============================================
// Federation Decorators
// ============================================

const keyMetadataStore = new Map<Function, string[]>();
const externalFieldsStore = new Map<Function, Set<string>>();
const requiresMetadataStore = new Map<string, string>();
const providesMetadataStore = new Map<string, string>();

/**
 * Mark an entity type with a key for federation
 */
export function Key(fields: string): ClassDecorator {
  return (target: Function) => {
    const existing = keyMetadataStore.get(target) || [];
    existing.push(fields);
    keyMetadataStore.set(target, existing);
  };
}

/**
 * Mark a field as external (defined in another service)
 */
export function External(): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const constructor = target.constructor as Function;
    const fields = externalFieldsStore.get(constructor) || new Set();
    fields.add(String(propertyKey));
    externalFieldsStore.set(constructor, fields);
  };
}

/**
 * Mark a field as requiring other fields
 */
export function Requires(fields: string): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const key = `${(target.constructor as Function).name}.${String(propertyKey)}`;
    requiresMetadataStore.set(key, fields);
  };
}

/**
 * Mark a field as providing other fields
 */
export function Provides(fields: string): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const key = `${(target.constructor as Function).name}.${String(propertyKey)}`;
    providesMetadataStore.set(key, fields);
  };
}

// ============================================
// Federated Subgraph Service
// ============================================

export class FederatedSubgraph {
  private options: FederationOptions;
  private schema: any = null;

  constructor(options: FederationOptions) {
    this.options = {
      path: '/graphql',
      graphiql: true,
      ...options,
    };
  }

  /**
   * Build the federated schema
   */
  async buildSchema(): Promise<any> {
    try {
      const { buildSubgraphSchema } = await this.loadFederationLib();

      // Add federation type definitions
      const typeDefs = `
        ${federationDirectives}
        ${this.options.typeDefs}
        
        extend type Query {
          _service: _Service!
          _entities(representations: [_Any!]!): [_Entity]!
        }
      `;

      // Add federation resolvers
      const resolvers = {
        ...this.options.resolvers,
        Query: {
          ...this.options.resolvers?.Query,
          _service: () => ({ sdl: this.options.typeDefs }),
          _entities: (root: any, { representations }: any, context: any) => {
            return representations.map((ref: any) => {
              const typeName = ref.__typename;
              const resolver = this.options.resolvers?.[typeName]?.__resolveReference;
              if (resolver) {
                return resolver(ref, context);
              }
              return ref;
            });
          },
        },
      };

      const { buildSchema, parse } = await import('graphql');
      this.schema = buildSchema(typeDefs);
      return this.schema;
    } catch (error: any) {
      console.warn('Federation library not found, using basic schema:', error.message);
      const { buildSchema } = await import('graphql');
      this.schema = buildSchema(this.options.typeDefs);
      return this.schema;
    }
  }

  /**
   * Get middleware handler
   */
  getMiddleware(): MiddlewareHandler {
    return async (req: CanxRequest, res: CanxResponse) => {
      try {
        if (!this.schema) {
          await this.buildSchema();
        }

        const { graphql } = await import('graphql');

        let query: string | undefined;
        let variables: Record<string, any> | undefined;

        if (req.method === 'GET') {
          const url = new URL((req as any).url);
          query = url.searchParams.get('query') || undefined;

          if (!query && this.options.graphiql) {
            return res.html(this.getGraphiQLPage());
          }
        } else {
          const body = await req.json() as any;
          query = body.query;
          variables = body.variables;
        }

        if (!query) {
          return res.status(400).json({ errors: [{ message: 'Missing query' }] });
        }

        const context = this.options.context
          ? await this.options.context({ req, res })
          : { req, res };

        const result = await graphql({
          schema: this.schema,
          source: query,
          variableValues: variables,
          contextValue: context,
          rootValue: this.options.resolvers,
        });

        return res.json(result);
      } catch (error: any) {
        return res.status(500).json({
          errors: [{ message: error.message || 'Internal error' }],
        });
      }
    };
  }

  private async loadFederationLib(): Promise<any> {
    try {
      return await import('@apollo/subgraph');
    } catch {
      throw new Error(
        'Apollo Subgraph not found. Install: npm install @apollo/subgraph'
      );
    }
  }

  private getGraphiQLPage(): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <title>Federated Service: ${this.options.name}</title>
    <style>body { height: 100%; margin: 0; } #graphiql { height: 100vh; }</style>
    <script crossorigin src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
    <link href="https://unpkg.com/graphiql/graphiql.min.css" rel="stylesheet" />
    <script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
  </head>
  <body>
    <div id="graphiql"></div>
    <script>
      ReactDOM.render(
        React.createElement(GraphiQL, { 
          fetcher: GraphiQL.createFetcher({ url: '${this.options.path}' })
        }),
        document.getElementById('graphiql')
      );
    </script>
  </body>
</html>`;
  }
}

// ============================================
// Federation Gateway
// ============================================

export class FederationGateway {
  private options: GatewayOptions;
  private gateway: any = null;

  constructor(options: GatewayOptions) {
    this.options = {
      path: '/graphql',
      pollInterval: 10000,
      introspection: true,
      ...options,
    };
  }

  /**
   * Build the gateway
   */
  async build(): Promise<void> {
    try {
      const { ApolloGateway, IntrospectAndCompose } = await this.loadGatewayLib();
      const { ApolloServer } = await import('@apollo/server');

      this.gateway = new ApolloGateway({
        supergraphSdl: new IntrospectAndCompose({
          subgraphs: this.options.services.map(s => ({
            name: s.name,
            url: s.url,
          })),
          pollIntervalInMs: this.options.pollInterval,
        }),
      });

    } catch (error: any) {
      console.warn('Apollo Gateway not found:', error.message);
      throw new Error(
        'Install: npm install @apollo/gateway @apollo/server @apollo/composition'
      );
    }
  }

  /**
   * Get middleware handler
   */
  getMiddleware(): MiddlewareHandler {
    return async (req: CanxRequest, res: CanxResponse) => {
      const body = req.method === 'POST' ? await req.json() as any : {};
      const { query, variables, operationName } = body;

      // In a full implementation, this would use the gateway to route
      // For now, return a placeholder
      return res.json({
        errors: [{ 
          message: 'Gateway requires @apollo/gateway. Install it and use ApolloServer with the gateway.' 
        }],
      });
    };
  }

  private async loadGatewayLib(): Promise<any> {
    try {
      return await import('@apollo/gateway');
    } catch {
      throw new Error(
        'Apollo Gateway not found. Install: npm install @apollo/gateway'
      );
    }
  }
}

// ============================================
// Reference Resolver Helper
// ============================================

export interface EntityReference {
  __typename: string;
  [key: string]: any;
}

export function resolveReference<T>(
  resolver: (reference: EntityReference, context: any) => T | Promise<T>
) {
  return resolver;
}

// ============================================
// Factory Functions
// ============================================

export function createFederatedSubgraph(options: FederationOptions): FederatedSubgraph {
  return new FederatedSubgraph(options);
}

export function createFederationGateway(options: GatewayOptions): FederationGateway {
  return new FederationGateway(options);
}

/**
 * Get key metadata for a type
 */
export function getKeyMetadata(target: Function): string[] {
  return keyMetadataStore.get(target) || [];
}

/**
 * Get external fields for a type
 */
export function getExternalFields(target: Function): Set<string> {
  return externalFieldsStore.get(target) || new Set();
}

export default FederatedSubgraph;
