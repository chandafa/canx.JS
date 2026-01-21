/**
 * Type declarations for optional GraphQL dependencies
 */

declare module 'graphql' {
  export function buildSchema(source: string | any): any;
  export function parse(source: string | any): any;
  export function execute(args: any): Promise<any>;
  export function subscribe(args: any): Promise<any>;
  export function validate(schema: any, document: any): any[];
  export function graphql(args: any): Promise<any>;
  export class GraphQLError extends Error {}
}

declare module '@graphql-tools/schema' {
  export function makeExecutableSchema(options: any): any;
}

declare module '@apollo/subgraph' {
  export function buildSubgraphSchema(options: any): any;
}

declare module '@apollo/gateway' {
  export class ApolloGateway {
    constructor(config: any);
    load(): Promise<any>;
  }
  export class IntrospectAndCompose {
    constructor(config: any);
  }
}

declare module '@apollo/server' {
  export class ApolloServer {
    constructor(config: any);
    start(): Promise<void>;
    executeHTTPGraphQLRequest(options: any): Promise<any>;
  }
}

declare module '@apollo/composition' {
  export function composeServices(services: any[]): any;
}

declare module 'graphql-yoga' {
  export function createYoga(options: any): any;
}
