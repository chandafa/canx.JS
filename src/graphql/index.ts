/**
 * CanxJS GraphQL Module
 * Comprehensive GraphQL support with code-first, schema-first, and federation
 */

// GraphQL Adapter (existing)
export { GraphQLAdapter, createGraphQLAdapter } from './GraphQLAdapter';
export type { GraphQLOptions } from './GraphQLAdapter';

// Code-First
export {
  // Type Decorators
  ObjectType,
  InputType,
  InterfaceType,
  registerEnumType,
  
  // Field Decorators
  Field,
  
  // Resolver Decorators
  Resolver,
  Query as GqlQuery,
  Mutation as GqlMutation,
  Subscription as GqlSubscription,
  ResolveField,
  Args,
  Root,
  Context as GqlContext,
  Info,
  
  // Schema Builder
  CodeFirstSchemaBuilder,
  createCodeFirstSchema,
  
  // PubSub
  InMemoryPubSub,
  createPubSub,
  
  // Utilities
  getTypeMetadata,
  getResolverMetadata,
} from './CodeFirst';
export type {
  FieldOptions,
  ObjectTypeOptions,
  InputTypeOptions,
  ArgsOptions,
  ResolverMethodOptions,
  GraphQLType,
  PubSubEngine,
} from './CodeFirst';

// Schema-First
export {
  SchemaFirstHandler,
  createSchemaFirstHandler,
  createSchemaFromSDL,
  
  // Schema Loading
  loadSchemaFromFile,
  loadSchemaFromFiles,
  loadSchemaFromDirectory,
  
  // Schema Merging
  mergeSchemas,
  
  // Built-in Directives
  builtInDirectives,
  authDirective,
  cacheDirective,
} from './SchemaFirst';
export type {
  SchemaFirstOptions,
  ResolverMap,
  ResolverFn,
  SubscriptionResolver,
  DirectiveMap,
  DirectiveImplementation,
  SchemaDirective,
  SchemaStitchingOptions,
} from './SchemaFirst';

// Federation
export {
  FederatedSubgraph,
  FederationGateway,
  createFederatedSubgraph,
  createFederationGateway,
  
  // Decorators
  Key,
  External,
  Requires,
  Provides,
  
  // Directives
  federationDirectives,
  
  // Utilities
  resolveReference,
  getKeyMetadata,
  getExternalFields,
} from './Federation';
export type {
  FederationOptions,
  FederatedServiceConfig,
  GatewayOptions,
  EntityReference,
} from './Federation';
