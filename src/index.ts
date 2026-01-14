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
export { MiddlewarePipeline, cors, logger, bodyParser, rateLimit, compress, createMiddlewarePipeline } from './core/Middleware';
export { security } from './middlewares/SecurityMiddleware';
export { rateLimit as rateLimitMiddleware } from './middlewares/RateLimitMiddleware';
export { validateSchema } from './middlewares/ValidationMiddleware';

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
export { BaseController, Controller, Get, Post, Put, Patch, Delete, Middleware, getControllerMeta } from './mvc/Controller';
export { Model, initDatabase, closeDatabase, query, execute } from './mvc/Model';
export { jsx, jsxs, Fragment, html, render, renderPage, createLayout, View } from './mvc/View';

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
export { validate, validateAsync, is } from './utils/Validator';
export { ResponseBuilder, response } from './utils/Response';
export { RequestParser, parseRequest } from './utils/Request';

// Error Handling
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
export { Canx, createApp } from './Application';

// ============================================
// Types
// ============================================
export type * from './types';
export type { CanxRequest as Request, CanxResponse as Response } from './types';

// ============================================
// Default Export
// ============================================
export { Canx as default } from './Application';
