/**
 * CanxJS GraphQL Schema-First Module
 * Build GraphQL APIs from SDL schema files
 */

import type { MiddlewareHandler, CanxRequest, CanxResponse } from '../types';

// ============================================
// Types & Interfaces
// ============================================

export interface SchemaFirstOptions {
  /** GraphQL schema definition (SDL string) */
  typeDefs: string;
  /** Resolver functions */
  resolvers: ResolverMap;
  /** Path to serve GraphQL endpoint */
  path?: string;
  /** Enable GraphiQL playground */
  graphiql?: boolean;
  /** Context factory */
  context?: (ctx: { req: CanxRequest; res: CanxResponse }) => any | Promise<any>;
  /** Schema directives */
  directives?: DirectiveMap;
}

export type ResolverMap = {
  Query?: Record<string, ResolverFn>;
  Mutation?: Record<string, ResolverFn>;
  Subscription?: Record<string, SubscriptionResolver>;
  [typeName: string]: Record<string, ResolverFn | SubscriptionResolver> | undefined;
};

export type ResolverFn = (
  parent: any,
  args: any,
  context: any,
  info: any
) => any | Promise<any>;

export interface SubscriptionResolver {
  subscribe: (parent: any, args: any, context: any, info: any) => AsyncIterator<any>;
  resolve?: (payload: any, args: any, context: any, info: any) => any;
}

export interface DirectiveMap {
  [directiveName: string]: DirectiveImplementation;
}

export interface DirectiveImplementation {
  visitFieldDefinition?: (field: any, details: any) => void;
  visitObject?: (type: any) => void;
  visitArgumentDefinition?: (argument: any, details: any) => void;
}

export interface SchemaDirective {
  name: string;
  locations: string[];
  args?: Record<string, { type: string; defaultValue?: any }>;
}

// ============================================
// Schema-First Handler
// ============================================

export class SchemaFirstHandler {
  private options: SchemaFirstOptions;
  private schema: any = null;

  constructor(options: SchemaFirstOptions) {
    this.options = {
      path: '/graphql',
      graphiql: true,
      ...options,
    };
  }

  /**
   * Build the executable schema
   */
  async buildSchema(): Promise<any> {
    try {
      const { buildSchema, parse, execute, subscribe } = await import('graphql');
      const { makeExecutableSchema } = await this.loadSchemaTools();

      this.schema = makeExecutableSchema({
        typeDefs: this.options.typeDefs,
        resolvers: this.options.resolvers,
      });

      return this.schema;
    } catch (error) {
      // Fallback to basic graphql
      const { buildSchema } = await import('graphql');
      this.schema = buildSchema(this.options.typeDefs);
      return this.schema;
    }
  }

  /**
   * Get the middleware handler
   */
  getMiddleware(): MiddlewareHandler {
    return async (req: CanxRequest, res: CanxResponse) => {
      try {
        const { graphql, parse, validate, execute, subscribe } = await import('graphql');

        if (!this.schema) {
          await this.buildSchema();
        }

        let query: string | undefined;
        let variables: Record<string, any> | undefined;
        let operationName: string | undefined;

        if (req.method === 'GET') {
          const url = new URL((req as any).url);
          query = url.searchParams.get('query') || undefined;
          const varsParam = url.searchParams.get('variables');
          variables = varsParam ? JSON.parse(varsParam) : undefined;
          operationName = url.searchParams.get('operationName') || undefined;

          // Serve GraphiQL
          if (!query && this.options.graphiql) {
            return res.html(this.getGraphiQLPage());
          }
        } else {
          const body = await req.json() as any;
          query = body.query;
          variables = body.variables;
          operationName = body.operationName;
        }

        if (!query) {
          return res.status(400).json({ errors: [{ message: 'Missing query' }] });
        }

        // Build context
        const context = this.options.context
          ? await this.options.context({ req, res })
          : { req, res };

        // Execute query
        const result = await graphql({
          schema: this.schema,
          source: query,
          variableValues: variables,
          contextValue: context,
          operationName,
          rootValue: this.options.resolvers,
        });

        return res.json(result);
      } catch (error: any) {
        console.error('GraphQL Error:', error);
        return res.status(500).json({
          errors: [{ message: error.message || 'Internal GraphQL Error' }],
        });
      }
    };
  }

  /**
   * Get schema for subscriptions
   */
  getSchema(): any {
    return this.schema;
  }

  /**
   * Load @graphql-tools/schema if available
   */
  private async loadSchemaTools(): Promise<any> {
    try {
      return await import('@graphql-tools/schema');
    } catch {
      throw new Error(
        'For full schema-first support, install @graphql-tools/schema: npm install @graphql-tools/schema'
      );
    }
  }

  private getGraphiQLPage(): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <title>CanxJS GraphiQL</title>
    <style>
      body { height: 100%; margin: 0; width: 100%; overflow: hidden; }
      #graphiql { height: 100vh; }
    </style>
    <script crossorigin src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
    <link href="https://unpkg.com/graphiql/graphiql.min.css" rel="stylesheet" />
    <script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
  </head>
  <body>
    <div id="graphiql">Loading...</div>
    <script>
      const fetcher = GraphiQL.createFetcher({ url: '${this.options.path}' });
      ReactDOM.render(
        React.createElement(GraphiQL, { fetcher: fetcher }),
        document.getElementById('graphiql'),
      );
    </script>
  </body>
</html>
    `;
  }
}

// ============================================
// Schema Loader (for .graphql files)
// ============================================

export async function loadSchemaFromFile(filePath: string): Promise<string> {
  const fs = await import('fs/promises');
  return fs.readFile(filePath, 'utf-8');
}

export async function loadSchemaFromFiles(filePaths: string[]): Promise<string> {
  const schemas = await Promise.all(filePaths.map(loadSchemaFromFile));
  return schemas.join('\n');
}

export async function loadSchemaFromDirectory(dir: string): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const files = await fs.readdir(dir);
  const graphqlFiles = files.filter(f => f.endsWith('.graphql') || f.endsWith('.gql'));

  const schemas = await Promise.all(
    graphqlFiles.map(f => fs.readFile(path.join(dir, f), 'utf-8'))
  );

  return schemas.join('\n');
}

// ============================================
// Schema Stitching & Merging
// ============================================

export interface SchemaStitchingOptions {
  schemas: Array<{
    typeDefs: string;
    resolvers?: ResolverMap;
  }>;
}

export async function mergeSchemas(options: SchemaStitchingOptions): Promise<{
  typeDefs: string;
  resolvers: ResolverMap;
}> {
  const typeDefs = options.schemas.map(s => s.typeDefs).join('\n');
  const resolvers: ResolverMap = {};

  for (const schema of options.schemas) {
    if (schema.resolvers) {
      for (const [typeName, typeResolvers] of Object.entries(schema.resolvers)) {
        if (!resolvers[typeName]) {
          resolvers[typeName] = {};
        }
        Object.assign(resolvers[typeName]!, typeResolvers);
      }
    }
  }

  return { typeDefs, resolvers };
}

// ============================================
// Common Directives
// ============================================

export const builtInDirectives = `
  directive @deprecated(reason: String = "No longer supported") on FIELD_DEFINITION | ENUM_VALUE
  directive @skip(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
  directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
`;

export const authDirective = `
  directive @auth(requires: Role = ADMIN) on FIELD_DEFINITION | OBJECT
  enum Role {
    ADMIN
    USER
    GUEST
  }
`;

export const cacheDirective = `
  directive @cacheControl(maxAge: Int, scope: CacheControlScope) on FIELD_DEFINITION | OBJECT | INTERFACE
  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }
`;

// ============================================
// Factory Functions
// ============================================

export function createSchemaFirstHandler(options: SchemaFirstOptions): SchemaFirstHandler {
  return new SchemaFirstHandler(options);
}

export function createSchemaFromSDL(typeDefs: string, resolvers: ResolverMap): SchemaFirstHandler {
  return new SchemaFirstHandler({ typeDefs, resolvers });
}

export default SchemaFirstHandler;
