/**
 * CanxJS - Ultra-fast async-first MVC backend framework for Bun
 * @version 1.0.0
 * @license MIT
 */

// ============================================
// Core Exports
// ============================================
export { Server, createCanxRequest, createCanxResponse } from './core/Server';
export { Router, createRouter } from './core/Router';
// ============================================
// Middleware Exports
// ============================================
export { MiddlewarePipeline, cors, logger, bodyParser, rateLimit, compress, serveStatic, createMiddlewarePipeline } from './core/Middleware';
export { security } from './middlewares/SecurityMiddleware';
export { rateLimit as rateLimitMiddleware } from './middlewares/RateLimitMiddleware';
export { validateSchema } from './middlewares/ValidationMiddleware';
export { csrf, csrfField, csrfMeta } from './middlewares/CsrfMiddleware';

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
export { BaseController, Controller, Get, Post, Put, Patch, Delete, Middleware, Validate, getControllerMeta } from './mvc/Controller';
export { Model, QueryBuilderImpl, initDatabase, closeDatabase, query, execute } from './mvc/Model';
export { jsx, jsxs, Fragment, html, render, renderPage, createLayout, View, view, viewExists } from './mvc/View';

// ============================================
// Feature Exports
// ============================================
export { hotWire, createHotWire } from './features/HotWire';
export { autoCache, autoCacheMiddleware, createAutoCache } from './features/AutoCache';
export { RequestBatcher, createBatcher } from './features/RequestBatcher';
export { jitCompiler, createJITCompiler, JITCompiler } from './features/JITCompiler';
export { scheduler, createScheduler, Scheduler } from './features/Scheduler';

// ============================================
// Auth Exports
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

// ============================================
// Database Exports
// ============================================
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
export { container, bind, singleton, resolve, Injectable, Inject, Container, ScopedContainer, containerMiddleware } from './container/Container';
export type { ServiceProvider } from './container/Container';

// ============================================
// Utils Exports
// ============================================
export { validate, validateAsync, is, extend, extendAsync, extendParam, setMessage } from './utils/Validator';
// Utils - Request/Response
export { ResponseBuilder, response } from './utils/Response';
export { RequestParser, parseRequest } from './utils/Request';

// Environment Helper
export { env, isProduction, isDevelopment, isTest, requireEnv } from './utils/Env';

// Error Handling
export { ErrorHandler } from './core/ErrorHandler';
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
// Application Exports
// ============================================
export { Canx, createApp, defineConfig } from './Application';

// ============================================
// Types
// ============================================
export type * from './types';
export type { CanxRequest as Request, CanxResponse as Response } from './types';

// ============================================
// Default Export
// ============================================
export { Canx as default } from './Application';
