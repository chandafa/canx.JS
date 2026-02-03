/**
 * CanxJS - Ultra-fast async-first MVC backend framework for Bun
 * @version 1.0.0
 * @license MIT
 */

// ============================================
// Core Exports
// ============================================

export { Server, Server as CanxServer } from './core/Server';
export { Router } from './core/Router';

export { Canx, createApp, defineConfig, createApplication, Application } from './Application';
export { Action } from './core/Action';
export type { ServerConfig } from './types';
export { ErrorHandler } from './core/ErrorHandler';
export type { CanxRequest, CanxResponse, HttpMethod, CanxApplication, CastType, NextFunction } from './types';
// ============================================
// Middleware Exports
// ============================================
export { MiddlewarePipeline, cors, logger, bodyParser, rateLimit, compress, serveStatic, createMiddlewarePipeline } from './core/Middleware';
export { security } from './middlewares/SecurityMiddleware';

export { validateSchema } from './middlewares/ValidationMiddleware';
export { csrf, csrfField, csrfMeta } from './middlewares/CsrfMiddleware';
export { SessionMiddleware } from './middlewares/SessionMiddleware';
export { Session as SessionStore } from './core/Session';

// ============================================
// Schema / Validation Exports
// ============================================
export { z, Schema as ZSchema } from './schema/Schema';
export type { Infer } from './schema/Schema';
export { ClientGenerator } from './generator/ClientGenerator';
export { TestClient } from './testing/TestClient';

// ============================================
// MVC Exports
// ============================================
export { 
  BaseController, 
  Controller, 
  Get, 
  Post, 
  Put, 
  Patch, 
  Delete, 
  Options, 
  Head, 
  Middleware, 
  Validate, 
  getControllerMeta,
  wrapWithParamResolution,
} from './mvc/Controller';
export { Model, QueryBuilderImpl, initDatabase, closeDatabase, query, execute } from './mvc/Model';
export { jsx, jsxs, Fragment, html, render, renderPage, createLayout, View, view, viewExists } from './mvc/View';

// Model Observers
export {
  Observer,
  OnCreating,
  OnCreated,
  OnUpdating,
  OnUpdated,
  OnSaving,
  OnSaved,
  OnDeleting,
  OnDeleted,
  OnRestoring,
  OnRestored,
  OnRetrieved,
  OnReplicating,
  defineObserver,
  registerModelObserver,
  dispatchModelEvent,
  withObservers,
  getRegisteredObservers,
  clearObservers,
} from './mvc/ModelObserver';
export type { ModelLifecycleEvent, ModelEventData, ModelEventHandler, ObserverDefinition } from './mvc/ModelObserver';

// ============================================
// Parameter Decorators
// ============================================
export {
  Body,
  Param,
  Query,
  Headers,
  Req,
  Request,
  Res,
  Response,
  User,
  Ip,
  Session,
  UploadedFile,
  UploadedFiles,
  createCustomParamDecorator,
  getParamMetadata,
  resolveParam,
  resolveParams,
  // Built-in pipes
  ParseIntPipe as ParamParseIntPipe,
  ParseFloatPipe as ParamParseFloatPipe,
  ParseBoolPipe as ParamParseBoolPipe,
  ParseUUIDPipe,
  ParseJsonPipe,
  TrimPipe as ParamTrimPipe,
  LowerCasePipe,
  UpperCasePipe,
  DefaultValuePipe as ParamDefaultValuePipe,
  ParseArrayPipe,
  ZodValidationPipe,
} from './core/Decorators';
export type { ParamMetadata, ParamType, PipeTransform as ParamPipeTransform } from './core/Decorators';

// ============================================
// Feature Exports
// ============================================
export { hotWire, createHotWire } from './features/HotWire';
export { autoCache, autoCacheMiddleware, createAutoCache } from './features/AutoCache';
export { RequestBatcher, createBatcher } from './features/RequestBatcher';
export { jitCompiler, createJITCompiler, JITCompiler } from './features/JITCompiler';
export { scheduler, createScheduler, Scheduler } from './features/Scheduler';
export { payment, PaymentManager } from './payment/PaymentManager';

// Queue & Jobs
export { queue, createQueue, Queue, MemoryDriver as QueueMemoryDriver, RedisDriver as QueueRedisDriver } from './queue/Queue';
export type { QueueConfig, QueueDriver, Job } from './queue/Queue';
export {
  chain,
  chainJobs,
  JobChain,
  continueChain,
  failChain,
  isChainedJob,
  getChainInfo,
} from './queue/JobChain';
export type { ChainableJob, ChainOptions, PendingChain } from './queue/JobChain';
export {
  batch,
  JobBatch,
  getBatch,
  cancelBatch,
  completeBatchJob,
  failBatchJob,
  isBatchedJob,
  getBatchInfo,
  listBatches,
  clearCompletedBatches,
} from './queue/JobBatch';
export type { BatchableJob, BatchOptions, BatchInfo, BatchProgress, BatchStatus, PendingBatch } from './queue/JobBatch';

// ============================================
// Auth Exports (Core Only)
// ============================================
export { 
  auth,
  hashPassword,
  verifyPassword,
  signJWT,
  verifyJWT,
  jwtAuth,
  optionalAuth,
  protect,
  guest,
  roles,
  sessionAuth,
  sessionStore,
  DatabaseSessionDriver,
  // Gates & Policies
  gate,
  defineGate,
  definePolicy,
  registerPolicy,
  allows,
  denies,
  authorize,
  can,
  cannot,
  canAny,
  Gate,
  UserGate,
  AuthorizationException,
  // Guards
  authManager,
  initAuth,
  authMiddleware,
  requireAuth,
  guestOnly,
  SessionGuard,
  TokenGuard,
  JwtGuard,
  AuthManager,
  // Social Auth
  SocialManager,
  GoogleProvider,
  GithubProvider,
} from './auth';

export type { 
  Ability, 
  Policy, 
  PolicyClass, 
  GateCallback,
  AuthUser, 
  GuardDriver, 
  GuardConfig,
  OAuthUser,
  SocialProvider,
} from './auth';

// ============================================
// API Versioning Exports
// ============================================
export { 
  versioning, 
  versionedHandler, 
  Version, 
  getVersion, 
  stripVersionPrefix,
  urlVersioning,
  headerVersioning,
  queryVersioning,
} from './utils/ApiVersioning';
export type { VersioningConfig, VersionedRoute } from './utils/ApiVersioning';

// NOTE: OpenAPI/Swagger, CQRS, Microservices, and GraphQL have been moved to their own entry points.
// Please import them from 'canxjs/microservices', 'canxjs/cqrs', 'canxjs/graphql', etc.

// ============================================
// API Resources Exports
// ============================================
// Replaced by utils/Resource.ts (JsonResource)

// ============================================
// Tagged Cache Exports
// ============================================
export { 
  TaggedCache, 
  TaggedCacheScope,
  MemoryCacheDriver,
  initCache, 
  cache, 
  createCache 
} from './cache/TaggedCache';
export type { CacheConfig, CacheItem, CacheStats, CacheDriver } from './cache/TaggedCache';

// ============================================
// Config Manager Exports
// ============================================
export { ConfigManager, initConfig, config, env as configEnv } from './config/ConfigManager';
export type { ConfigValue } from './config/ConfigManager';

// ============================================
// Service Provider Exports
// ============================================
export { 
  ServiceProvider as AppServiceProvider,
  ServiceProvider, 
  DeferredServiceProvider, 
  ApplicationKernel, 
  kernel, 
  initKernel 
} from './core/ServiceProvider';
export type { Provider } from './core/ServiceProvider';

// ============================================
// Pipeline Exports
// ============================================
export { 
  Pipeline, 
  pipeline, 
  createPipe, 
  tap, 
  when as pipeWhen, 
  unless, 
  transform 
} from './utils/Pipeline';
export type { PipeHandler, PipeFunction, PipeStage } from './utils/Pipeline';

// ============================================
// Module System Exports
// ============================================
export { 
  Module,
  ModuleContainer,
  CanxModule,
  getModuleMetadata,
  Injectable as ModInjectable,
  isInjectable as isModInjectable,
  Inject as ModInject,
  getInjectMetadata,

  createModuleContainer,
  // New: Dynamic Modules
  Global,
  isGlobalModule,
  LazyModule,
  isLazyModule,
  getLazyModuleLoader,
  isDynamicModule,
} from './core/Module';
export type { 
  ModuleMetadata, 
  Provider as ModProvider, 
  ModuleRef,
  DynamicModule,
  AsyncModuleOptions,
} from './core/Module';

// ============================================
// AOP (Aspect-Oriented Programming) Exports
// ============================================
export { 
  createGuard,
  applyGuards,
  createInterceptor,
  applyInterceptors,
  createPipe as createAopPipe,
  ParseIntPipe,
  ParseFloatPipe,
  ParseBoolPipe,
  TrimPipe,
  DefaultValuePipe,
  createExceptionFilter,
  applyExceptionFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
  getGuardMetadata,
  getInterceptorMetadata,
} from './core/AOP';
export type { 
  ExecutionContext, 
  CanActivate, 
  Interceptor, 
  PipeTransform, 
  ExceptionFilter 
} from './core/AOP';

// NOTE: Microservices, CQRS, and GraphQL have been moved to their own entry points (e.g. 'canxjs/microservices').

export { Schema, migrator, defineMigration } from './database/Migration';
export { seeder, fake, factory as seederFactory, defineSeeder } from './database/Seeder';

// ============================================
// Queue Exports (Additional UI)
// ============================================
export { QueueController } from './queue/ui/QueueController';

// ============================================
// Realtime Exports
// ============================================
export { channel, createChannel } from './realtime/Channel';
export { ws, createWebSocketServer, WebSocketServer } from './realtime/WebSocket';
export {
  broadcast,
  broadcasting,
  initBroadcast,
  BroadcastManager,
  PusherDriver,
  AblyDriver,
  BroadcastableEvent,
} from './realtime/Broadcasting';
export type { BroadcastEvent, BroadcastResult, PusherConfig, AblyConfig } from './realtime/Broadcasting';



// ============================================
// Events Exports
// ============================================
export { events, createEventEmitter, EventEmitter, Listen, getEventListeners, EventServiceProvider } from './events/EventEmitter';

// ============================================
// Notifications Exports
// ============================================
export { initMail, mail, sendMail, Mailer, MailBuilder } from './notifications/Mail';
export { notifications, notify, notifyMany, Notification, makeNotifiable } from './notifications/Notification';
export type { MailMessage, MailConfig, MailAddress, MailAttachment } from './notifications/Mail';
export type { Notifiable, NotificationChannel } from './notifications/Notification';
export { 
  sms, 
  initSms, 
  sendSms, 
  SmsManager, 
  SmsChannel, 
  TwilioDriver, 
  VonageDriver 
} from './notifications/channels/SmsChannel';
export type { SmsMessage, SmsResult, TwilioConfig, VonageConfig } from './notifications/channels/SmsChannel';

// ============================================
// Internationalization (i18n) Exports
// ============================================
export { Translator, translator } from './i18n/Translator';
export { localizationMiddleware } from './i18n/LocalizationMiddleware';
export { __, trans, trans_choice } from './i18n/helpers';

// ============================================
// Adapter Exports (Inertia)
// ============================================
export { InertiaManager, inertiaManager } from './inertia/InertiaManager';
export { inertiaMiddleware } from './inertia/InertiaMiddleware';
export type { InertiaConfig } from './inertia/InertiaManager';

// ============================================
// Frontend Integration Exports
// ============================================
export { Vite, viteManager } from './vite/Vite';
export { vite, vite_react_refresh, vite_asset } from './vite/helpers';

// ============================================
// Search (Scout) Exports
// ============================================
export { Scout, searchManager, SearchManager } from './search/SearchManager';
export { Search, search } from './search/Searchable';
export { SearchBuilder, type SearchEngine } from './search/engines/Engine';
export { DatabaseEngine } from './search/engines/DatabaseEngine';

// ============================================
// Storage Exports
// ============================================
// ============================================
// Storage Exports
// ============================================
export { storage, initStorage, handleUpload, handleMultipleUploads } from './storage/Storage';
export { S3Driver } from './storage/drivers/S3Driver';
export { GCSDriver } from './storage/drivers/GCSDriver';
export { LocalDriver } from './storage/drivers/LocalDriver';
export type { StorageDriver, StorageConfig, FileMetadata } from './storage/drivers/types';

// ============================================
// Container / DI Exports
// ============================================
export {
  container,
  bind,
  singleton,
  resolve,
  Injectable,
  Inject,
  Container,
  ScopedContainer,
  containerMiddleware,
  forwardRef,
  isForwardRef,
  Scope,
  AutoWire,
} from './container/Container';
export type { ForwardRef } from './container/Container';
export { 
  requestScopeMiddleware,
  runInRequestContext,
  runWithRequestId,
  setRequestContext,
  getRequestId,
  clearRequestContext,
} from './container/Scope';
export type { InjectableOptions } from './container/Scope';

// NOTE: GraphQL module has been moved to 'canxjs/graphql'.




// ============================================
// HTTP/2 Exports
// ============================================
export {
  Http2Server,
  createHttp2Server,
  startHttp2,
  createHttp2Middleware,
} from './core/Http2Server';
export type {
  Http2ServerOptions,
  PushOptions,
  Http2Stream,
} from './core/Http2Server';

// ============================================
// Lifecycle Exports
// ============================================
export type {
  OnModuleInit,
  OnApplicationBootstrap,
  OnModuleDestroy,
  BeforeApplicationShutdown,
  OnApplicationShutdown,
} from './core/Lifecycle';

// ============================================
// Health Check Exports
// ============================================
export {
  HealthModule,
  HealthCheckService,
  HealthIndicator,
  DatabaseHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckError,
} from './health/HealthModule';
export type {
  HealthCheckStatus,
  HealthIndicatorResult,
  HealthCheckResult as TerminusHealthCheckResult,
} from './health/HealthModule';

// ============================================
// Enterprise Features (Phase 1)
// ============================================

// Cluster Mode
export {
  ClusterManager,
  initCluster,
  cluster,
  withCluster,
} from './core/ClusterManager';
export type { ClusterConfig } from './core/ClusterManager';

// Enhanced Health Checks (Kubernetes-ready)
export {
  HealthCheckManager,
  initHealthChecks,
  healthChecks,
  createHealthRoutes,
  createDatabaseCheck,
  createRedisCheck,
  createHttpCheck,
  createMemoryCheck,
  createDiskCheck,
  createCustomCheck,
} from './core/HealthChecks';
export type {
  HealthStatus as K8sHealthStatus,
  HealthCheckResult as K8sHealthCheckResult,
  ComponentHealth,
  FullHealthReport,
  HealthCheckOptions,
} from './core/HealthChecks';

// Graceful Shutdown
export {
  GracefulShutdown,
  initGracefulShutdown,
  gracefulShutdown,
  setupGracefulShutdown,
} from './core/GracefulShutdown';
export type { GracefulShutdownConfig } from './core/GracefulShutdown';

// Maintenance Mode
export {
  MaintenanceManager,
  initMaintenance,
  maintenance,
  isDownForMaintenance,
  maintenanceMiddleware,
  preCheckMaintenance,
} from './core/MaintenanceMode';
export type { MaintenancePayload, MaintenanceConfig, MaintenanceMiddlewareOptions } from './core/MaintenanceMode';

// ============================================
// Enterprise Features (Phase 2 - Scalability)
// ============================================

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitBreakerError,
  getCircuitBreaker,
  createCircuitBreaker,
  getCircuitBreakerStatus,
  WithCircuitBreaker,
} from './core/CircuitBreaker';
export type {
  CircuitState,
  CircuitBreakerConfig,
} from './core/CircuitBreaker';

// Distributed Sessions
export {
  DistributedSession,
  MemorySessionStore,
  RedisSessionStore,
  initDistributedSessions,
  distributedSession,
  distributedSessionMiddleware,
} from './core/DistributedSession';
export type {
  DistributedSessionConfig,
  SessionData,
  SessionStore as DistributedSessionStore,
} from './core/DistributedSession';

// Rate Limiter v2
export {
  RateLimiterV2,
  MemoryRateLimitStore as MemoryRateLimitStoreV2,
  RedisRateLimitStore,
  TieredRateLimiter,
  createRateLimiterV2,
  createTieredRateLimiter,
} from './core/RateLimiterV2';
export type {
  RateLimitAlgorithm,
  RateLimiterV2Config,
  RateLimitStore as RateLimitStoreV2,
  RateLimitResult,
  RateLimitTier,
} from './core/RateLimiterV2';

// ============================================
// Enterprise Features (Phase 3 - Microservices)
// ============================================

// Event Bus
export {
  EventBus,
  MemoryEventBusDriver,
  RedisEventBusDriver,
  initEventBus,
  eventBus,
  createEventBus,
  Subscribe,
  registerEventHandlers,
} from './microservices/EventBus';
export type {
  EventHandler,
  EventMessage,
  EventBusConfig,
  EventBusDriver,
} from './microservices/EventBus';

// Service Registry
export {
  ServiceRegistry,
  MemoryServiceRegistryDriver,
  RedisServiceRegistryDriver,
  LoadBalancer,
  initServiceRegistry,
  serviceRegistry,
  createServiceRegistry,
} from './microservices/ServiceRegistry';
export type {
  ServiceInstance,
  ServiceRegistryConfig,
  ServiceRegistryDriver,
} from './microservices/ServiceRegistry';

// ============================================
// Enterprise Features (Phase 4 - Observability)
// ============================================

// Metrics (Prometheus)
export {
  Metrics,
  MemoryMetricsDriver,
  initMetrics,
  metrics,
  createMetrics,
} from './observability/Metrics';
export type {
  MetricConfig,
  MetricLabels,
  MetricsDriver,
} from './observability/Metrics';

// Tracing (OpenTelemetry)
export {
  Tracing,
  NoopTracer,
  NoopSpan,
  initTracing,
  trace,
  Trace,
} from './observability/Tracing';
export type {
  Tracer,
  Span,
  SpanContext,
  SpanOptions,
} from './observability/Tracing';

// ============================================
// Enterprise Features (Phase 5 - Security)
// ============================================

// Audit Logging
export {
  AuditLogger,
  ConsoleAuditDriver,
  FileAuditDriver,
  initAuditLogger,
  auditLogger,
  Audit,
} from './security/AuditLogger';
export type {
  AuditLogEntry,
  AuditLoggerConfig,
  AuditLogDriver,
  AuditLogFilters,
} from './security/AuditLogger';

// Secrets Manager
export {
  SecretsManager,
  EnvSecretStore,
  MemorySecretStore,
  initSecrets,
  secrets,
} from './security/SecretsManager';
export type { SecretStore } from './security/SecretsManager';

// OAuth2 Provider
export {
  OAuth2Server,
  MemoryOAuth2Storage,
} from './security/OAuth2Provider';
export type {
  OAuth2Client,
  OAuth2Token,
  OAuth2AuthorizationCode,
  OAuth2Storage,
} from './security/OAuth2Provider';

// ============================================
// Innovation Features (Phase 6 - Universal Signals)
// ============================================
export {
  Signal,
  createSignal,
} from './universal/Signal';
export type { SignalOptions, SignalListener } from './universal/Signal';

export {
  signalRegistry,
  SignalRegistry,
  useSignal,
} from './universal/SignalRegistry';

export {
  signalServer,
  SignalServer,
  broadcastSignalUpdate,
} from './universal/SignalServer';

// ============================================
// Innovation Features (Phase 7 - Canx Flow)
// ============================================
export {
  workflowEngine,
  WorkflowEngine,
  WorkflowContext,
  MemoryWorkflowStorage,
  workflow,
} from './flow/Workflow';
export type {
  WorkflowState,
  WorkflowEvent,
  WorkflowStorage,
  WorkflowStatus,
} from './flow/Workflow';

// ============================================
// Utils Exports
// ============================================
export { 
  RateLimiter, 
  rateLimit as createRateLimiter, 
  createMemoryStore, 
  createCacheStore,
  createRedisStore,
  RedisStore,
  MemoryStore
} from './middlewares/RateLimiter';
export type { RateLimitOptions, RateLimitStore } from './middlewares/RateLimiter';

export { 
  QueryParser, 
  parseQuery, 
  QueryParams 
} from './utils/QueryParser';
export type { QueryOptions, SortOption, PaginationMeta as ApiPaginationMeta } from './utils/QueryParser';


export { validate, validateAsync, is, extend, extendAsync, extendParam, setMessage } from './utils/Validator';

// ============================================
// Testing Exports
// ============================================
export { 
  HttpTest, 
  DatabaseTest,
  createHttpTest,
  TestCase
} from './testing/TestHelper';
export type { HttpTestResponse as HelperTestResponse } from './testing/TestHelper';
export { browse, Browser, Chrome } from './testing/index';
export type { BrowserConfig } from './testing/index';
// Utils - Request/Response
export { ResponseBuilder, response } from './utils/Response';
export { RequestParser, parseRequest } from './utils/Request';

// Environment Helper
export { env, isProduction, isDevelopment, isTest, requireEnv } from './utils/Env';

// Error Handling
export { CanxException } from './core/exceptions/CanxException';
export { HttpException } from './core/exceptions/HttpException';
export { NotFoundException } from './core/exceptions/NotFoundException';
export { ValidationException } from './core/exceptions/ValidationException';
export { ViewNotFoundException } from './core/exceptions/ViewNotFoundException';
export { UnauthorizedException } from './core/exceptions/UnauthorizedException';
export { ForbiddenException } from './core/exceptions/ForbiddenException';
export { MethodNotAllowedException } from './core/exceptions/MethodNotAllowedException';
export { BadRequestException } from './core/exceptions/BadRequestException';
export { ConflictException } from './core/exceptions/ConflictException';
export { TooManyRequestsException } from './core/exceptions/TooManyRequestsException';
export { ServiceUnavailableException } from './core/exceptions/ServiceUnavailableException';
export { InternalServerException } from './core/exceptions/InternalServerException';
export {
  CanxError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
  BadRequestError,
  DatabaseError,
  ServiceUnavailableError,
  errorHandler,
  asyncHandler,
  assertFound,
  assertAuthenticated,
  assertAuthorized,
  assertValid,
  errors,
} from './utils/ErrorHandler';

// Logging
export { log, createLogger, Logger, requestLogger, createFileTransport } from './utils/Logger';
export type { LogLevel } from './utils/Logger';

// Health Checks & Metrics
export {
  health,
  // metrics, // Use 'metrics' from observability/Metrics instead
  databaseCheck,
  memoryCheck,
  diskCheck,
  httpCheck,
  redisCheck,
  customCheck,
  healthRoutes,
  createHealthManager,
} from './utils/Health';
export type { HealthCheckResult, HealthReport, HealthStatus, HealthChecker } from './utils/Health';

// ... (skipping to Tracing section)

// ============================================
// Observability / Tracing (Legacy/Module)
// ============================================
export { TracingModule } from './core/Tracing';
// Trace, Tracer, Span are now exported from observability/Tracing

// ============================================
// Developer Tools
// ============================================
export { DevToolsModule } from './devtools/DevToolsModule';

// ============================================
// AsyncAPI & Events
// ============================================
export { AsyncApiGenerator, AsyncApiChannel, AsyncApiMessage } from './features/AsyncApi';
export type { AsyncApiOptions, AsyncApiInfo } from './features/AsyncApi';


