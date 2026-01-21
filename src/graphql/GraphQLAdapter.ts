/**
 * CanxJS GraphQL Adapter
 * Integration layer for GraphQL servers
 */
// @ts-nocheck
import type { CanxRequest, CanxResponse, MiddlewareHandler, NextFunction } from '../types';

// ============================================
// Types
// ============================================

export interface GraphQLOptions {
  schema?: any;
  typeDefs?: any;
  resolvers?: any;
  context?: (ctx: { req: CanxRequest; res: CanxResponse }) => Promise<any> | any;
  graphiql?: boolean;
  path?: string;
  driver?: 'apollo' | 'yoga' | 'custom';
  driverConfig?: any;
}

// ============================================
// GraphQL Adapter
// ============================================

export class GraphQLAdapter {
  private options: GraphQLOptions;
  private handler: MiddlewareHandler | null = null;

  constructor(options: GraphQLOptions) {
    this.options = {
      path: '/graphql',
      graphiql: true,
      driver: 'custom',
      ...options,
    };
  }

  /**
   * Register GraphQL middleware
   */
  async register(server: any): Promise<void> {
    if (this.options.driver === 'apollo') {
      await this.createApolloHandler();
    } else if (this.options.driver === 'yoga') {
      await this.createYogaHandler();
    } else if (this.options.driver === 'custom' && this.options.schema) {
      this.createCustomHandler();
    } else {
      throw new Error('Invalid GraphQL driver configuration. Provide schema or select a driver.');
    }

    if (this.handler) {
      server.post(this.options.path, this.handler);
      if (this.options.graphiql) {
        server.get(this.options.path, this.handler);
      }
    }
  }

  /**
   * Get the middleware handler
   */
  getMiddleware(): MiddlewareHandler {
    if (!this.handler) {
      throw new Error('GraphQL handler not initialized. Call register() first.');
    }
    return this.handler;
  }

  /**
   * Create Custom Handler (Simple Implementation)
   */
  private createCustomHandler(): void {
    // This is a minimal implementation for validation if no external lib is present
    this.handler = async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
      try {
        const { graphql } = await import('graphql');
        
        let query: string | undefined;
        let variables: Record<string, any> | undefined;

        if (req.method === 'GET') {
          query = (req as any).query?.query;
          variables = (req as any).query?.variables ? JSON.parse((req as any).query.variables) : undefined;
        } else {
          const body = await req.json();
          query = body.query;
          variables = body.variables;
        }

        if (!query) {
          if (this.options.graphiql && req.method === 'GET') {
            return res.html(this.getGraphiQLPage());
          }
          return res.status(400).json({ error: 'Missing query' });
        }

        const context = this.options.context 
          ? await this.options.context({ req, res }) 
          : { req, res };

        const result = await graphql({
          schema: this.options.schema,
          source: query,
          variableValues: variables,
          contextValue: context,
          rootValue: this.options.resolvers,
        });

        return res.json(result);
      } catch (error) {
        console.error('GraphQL Error:', error);
        return res.status(500).json({ error: 'Internal GraphQL Error' });
      }
    };
  }

  /**
   * Create Apollo Server Handler
   */
  private async createApolloHandler(): Promise<void> {
    try {
      // Dynamic import to avoid hard dependency
      // User must install @apollo/server
      const { ApolloServer } = await import('@apollo/server');
      
      const server = new ApolloServer({
        typeDefs: this.options.typeDefs,
        resolvers: this.options.resolvers,
        ...this.options.driverConfig,
      });

      await server.start();

      this.handler = async (req: CanxRequest, res: CanxResponse) => {
        try {
          const body = req.method === 'POST' ? await req.json() : {};
          const query = (req as any).query || {};
          
          // Execute operation
          const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
            httpGraphQLRequest: {
              body,
              headers: req.headers as any, // Map headers appropriately
              method: req.method || 'POST',
              search: new URLSearchParams(query as any).toString(),
            },
            context: async () => this.options.context ? await this.options.context({ req, res }) : { req, res },
          });

          // Send response
          if (httpGraphQLResponse.status) {
            res.status(httpGraphQLResponse.status);
          }
          
          for (const [key, value] of httpGraphQLResponse.headers) {
            res.header(key, value);
          }

           // Check if body is "complete" body
           if (httpGraphQLResponse.body.kind === 'complete') {
             return res.html(httpGraphQLResponse.body.string);
           } else {
             // Chunked not fully supported in this simple adapter yet
              let chuckedData = '';
              for await (const chunk of httpGraphQLResponse.body.asyncIterator) {
                chuckedData += chunk;
              }
              return res.html(chuckedData);
           }
        } catch (e: any) {
          return res.status(500).json({ error: e.message });
        }
      };
    } catch (e) {
      console.warn('Apollo Server not found. Please install @apollo/server and graphql.');
      this.createCustomHandler(); // Fallback
    }
  }

  /**
   * Create Yoga Handler
   */
  private async createYogaHandler(): Promise<void> {
    try {
      const { createYoga } = await import('graphql-yoga');
      
      const yoga = createYoga({
        schema: this.options.schema, // Yoga often expects schema object
        graphiql: this.options.graphiql,
        graphqlEndpoint: this.options.path,
        context: this.options.context,
        ...this.options.driverConfig,
      });

      this.handler = async (req: CanxRequest, res: CanxResponse) => {
        const response = await yoga.fetch(
          req instanceof Request ? req : new Request((req as any).url, {
             method: req.method,
             headers: req.headers as any,
             body: req.method === 'POST' ? JSON.stringify(await req.json()) : undefined
          }),
          { req, res }
        );

        // Map response back to CanxResponse
        res.status(response.status);
        response.headers.forEach((value: string, key: string) => {
          res.header(key, value);
        });
        
        const text = await response.text();
        return res.html(text);
      };
    } catch (e) {
      console.warn('GraphQL Yoga not found. Please install graphql-yoga and graphql.');
      this.createCustomHandler(); // Fallback
    }
  }

  /**
   * Simple GraphiQL HTML
   */
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
    <script crossorigin src="https://unpkg.com/react@17/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"></script>
    <link href="https://unpkg.com/graphiql/graphiql.min.css" rel="stylesheet" />
    <script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
  </head>
  <body>
    <div id="graphiql">Loading...</div>
    <script>
      const fetcher = GraphiQL.createFetcher({
        url: '${this.options.path}',
      });
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
// Factory
// ============================================

export function createGraphQLAdapter(options: GraphQLOptions): GraphQLAdapter {
  return new GraphQLAdapter(options);
}

export default GraphQLAdapter;
