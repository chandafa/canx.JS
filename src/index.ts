/**
 * CanxJS - Ultra-fast async-first MVC backend framework for Bun
 * @version 1.0.0
 * @license MIT
 */

// ============================================
// Core Exports
// ============================================
// Core Exports
export { Server, Server as CanxServer } from './core/Server';
export { Router } from './core/Router';

export { Canx, createApp, defineConfig } from './Application';
export type { ServerConfig } from './types';
export { ErrorHandler } from './core/ErrorHandler';
export type { CanxRequest, CanxResponse, HttpMethod, CanxApplication } from './types';
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
} from './auth/Auth';

// Authorization (Gates & Policies)
export {
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
} from './auth/Gate';
export type { Ability, Policy, PolicyClass, GateCallback } from './auth/Gate';

// Auth Guards
export {
  authManager,
  initAuth,
  authMiddleware,
  requireAuth,
  guestOnly,
  SessionGuard,
  TokenGuard,
  JwtGuard,
  AuthManager,
} from './auth/Guard';
export type { AuthUser, GuardDriver, GuardConfig } from './auth/Guard';

// NOTE: OAuth, TwoFactor, and advanced Auth features should now be imported from 'canxjs/auth'
// or their specific submodules to reduce bundle size.

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
export { 
  Resource as ApiResource, 
  ResourceCollection as ApiResourceCollection, 
  paginatedResource,
  when as resourceWhen,
  whenNotNull as resourceWhenNotNull,
  mergeWhen as resourceMergeWhen,
  resource as transformResource,
  collection as transformCollection,
} from './utils/ApiResource';
export type { ResourceMeta as ApiResourceMeta, ResourceOptions, PaginatedData } from './utils/ApiResource';

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
// Queue Exports
// ============================================
export { queue, createQueue } from './queue/Queue';
export { RedisDriver } from './queue/drivers/RedisDriver';
export { MemoryDriver } from './queue/drivers/MemoryDriver';
export { QueueController } from './queue/ui/QueueController';

// ============================================
// Realtime Exports
// ============================================
export { channel, createChannel } from './realtime/Channel';
export { ws, createWebSocketServer, WebSocketServer } from './realtime/WebSocket';

// ============================================
// Storage Exports
// ============================================
export { storage, initStorage, handleUpload, handleMultipleUploads } from './storage/Storage';
export { LocalDriver } from './storage/drivers/LocalDriver';
export { S3Driver } from './storage/drivers/S3Driver';
export type { StorageDriver, StorageConfig, FileMetadata } from './storage/drivers/types';

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
export type { ServiceProvider, ForwardRef } from './container/Container';
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
export type { TestResponse as HelperTestResponse } from './testing/TestHelper';
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
  metrics,
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

// Internationalization
export { initI18n, useI18n, t, plural, I18n, i18nMiddleware } from './utils/i18n';
export type { I18nConfig, TranslationObject } from './utils/i18n';

// ============================================
// Security Exports
// ============================================

// Hashing (bcrypt, argon2, scrypt)
export { 
  hash, 
  hashPassword as hashMake, 
  verifyPassword as hashCheck, 
  needsRehash, 
  Hash 
} from './utils/Hash';
export type { HashDriver, HashOptions } from './utils/Hash';

// Encryption (AES-256-GCM)
export { 
  encryptor, 
  initEncrypt, 
  encrypt, 
  decrypt, 
  generateKey, 
  deriveKey, 
  Encrypt 
} from './utils/Encrypt';
export type { EncryptedPayload, EncryptConfig } from './utils/Encrypt';

// ============================================
// Pagination Exports
// ============================================
export { 
  Paginator, 
  SimplePaginator, 
  CursorPaginator, 
  paginate, 
  simplePaginate, 
  cursorPaginate 
} from './utils/Paginator';
export type { 
  PaginatedResult, 
  PaginationMeta, 
  PaginationLinks, 
  PaginatorOptions 
} from './utils/Paginator';

// ============================================
// Form Request Exports
// ============================================
export {
  FormRequest,
  formRequest,
  validated,
  getFormRequest,
  createFormRequest,
  ValidateWith,
} from './utils/FormRequest';
export type { FormRequestOptions } from './utils/FormRequest';

// ============================================
// API Resource Exports
// ============================================
export {
  JsonResource,
  Resource,
  ResourceCollection,
  AnonymousResource,
  resource,
  collection as resourceCollection,
  wrap,
  success,
  error,
  when,
  whenNotNull,
  whenLoaded,
  mergeWhen,
} from './utils/Resource';
export type {
  ResourceData,
  ResourceMeta,
  ResourceLinks,
  ResourceResponse,
} from './utils/Resource';

// ============================================
// Collection Exports
// ============================================
export {
  Collection,
  collect,
  range,
  times,
} from './utils/Collection';

// ============================================
// Testing Exports
// ============================================
export {
  ResponseAssertions,
  MockFactory,
  createTestClient,
  assertResponse,
  factory,
  randomString,
  randomEmail,
  randomNumber,
  randomUuid,
  sleep,
} from './testing/TestCase';
export type { TestResponse, TestRequest } from './testing/TestCase';

// ============================================
// Default Export
// ============================================
export { Canx as default } from './Application';
// ... (previous exports)

// ============================================
// Realtime / WebSockets (Advanced)
// ============================================
export {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  GATEWAY_METADATA,
} from './realtime/Decorators';
export { GatewayManager } from './realtime/GatewayManager';

// ============================================
// Advanced Testing
// ============================================
export { Test, TestingModuleBuilder } from './testing/Test';
export type { TestingModule } from './testing/Test';

// ============================================
// Observability / Tracing
// ============================================
export { TracingModule, Trace } from './core/Tracing';
export type { Tracer, Span } from './core/Tracing';

// ============================================
// Developer Tools
// ============================================
export { DevToolsModule } from './devtools/DevToolsModule';

// ============================================
// AsyncAPI & Events
// ============================================
export { AsyncApiGenerator, AsyncApiChannel, AsyncApiMessage } from './features/AsyncApi';
export type { AsyncApiOptions, AsyncApiInfo } from './features/AsyncApi';


