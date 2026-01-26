/**
 * CanxJS Framework - Core Type Definitions
 * Ultra-fast async-first MVC backend framework for Bun
 */

// Global JSX namespace for type compatibility
declare global {
  namespace JSX {
    // In CanxJS, JSX components return SafeString (SSR)
    // We allow string for raw usage but prefer SafeString
    type Element = string; // SafeString extends String
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// ============================================
// HTTP Types
// ============================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'ALL';

export interface RouteParams {
  [key: string]: string;
}

export interface QueryParams {
  [key: string]: string | string[] | undefined;
}

export interface CanxRequest {
  /** Original Bun Request object */
  raw: Request;
  /** HTTP method */
  method: HttpMethod;
  /** Request URL path */
  path: string;
  /** Route parameters (e.g., /users/:id -> { id: "123" }) */
  params: RouteParams;
  /** Query string parameters */
  query: QueryParams;
  /** Request headers */
  headers: Headers;
  /** Parsed request body */
  body: <T = unknown>() => Promise<T>;
  /** Get JSON body */
  json: <T = unknown>() => Promise<T>;
  /** Get form data */
  formData: () => Promise<FormData>;
  /** Get raw text */
  text: () => Promise<string>;
  /** Get array buffer */
  arrayBuffer: () => Promise<ArrayBuffer>;
  /** Uploaded files */
  files: () => Promise<Map<string, File>>;
  /** Get specific header */
  header: (name: string) => string | null;
  /** Get cookie value */
  cookie: (name: string) => string | undefined;
  /** Custom context data */
  context: Map<string, unknown>;
  /** Request timestamp */
  timestamp: number;
  /** Request ID for tracing */
  id: string;
  /** Authenticated user (set by auth middleware) */
  user?: unknown;
}

export interface CanxResponse {
  /** Set status code */
  status: (code: number) => CanxResponse;
  /** Set header */
  header: (name: string, value: string) => CanxResponse;
  /** Set multiple headers */
  headers: (headers: Record<string, string>) => CanxResponse;
  /** Send JSON response */
  json: <T = unknown>(data: T) => Response;
  /** Send HTML response */
  html: (content: string) => Response;
  /** Send text response */
  text: (content: string) => Response;
  /** Send file */
  file: (path: string) => Promise<Response>;
  /** Download file */
  download: (path: string, filename?: string) => Promise<Response>;
  /** Send stream */
  stream: (readable: ReadableStream) => Response;
  /** Redirect */
  redirect: (url: string, status?: 301 | 302 | 303 | 307 | 308) => Response;
  /** Set cookie */
  cookie: (name: string, value: string, options?: CookieOptions) => CanxResponse;
  /** Clear cookie */
  clearCookie: (name: string) => CanxResponse;
  /** Render JSX view */
  render: (component: JSX.Element) => Response;
  /** Send empty response */
  empty: (status?: number) => Response;
  /** Server-sent events stream */
  sse: (generator: AsyncGenerator<string>) => Response;
  /** Send HotWire/Turbo Stream fragment */
  hotwire: (content: string, options?: { target: string; action?: 'replace' | 'update' | 'prepend' | 'append' | 'remove' | 'after' | 'before' }) => Response;
  /** Whether headers have been sent */
  headersSent: boolean;
}

export interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

// ============================================
// Middleware Types
// ============================================

export type NextFunction = () => Promise<Response | void>;

export type MiddlewareHandler = (
  req: CanxRequest,
  res: CanxResponse,
  next: NextFunction
) => Promise<Response | void> | Response | void;

export interface Middleware {
  name: string;
  handler: MiddlewareHandler;
  paths?: string[];
  methods?: HttpMethod[];
}

// ============================================
// Router Types
// ============================================

export type RouteHandler = (
  req: CanxRequest,
  res: CanxResponse
) => Promise<Response> | Response;

export interface Route {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  middlewares?: MiddlewareHandler[];
  name?: string;
  meta?: Record<string, unknown>;
}

export interface RouteGroup {
  prefix: string;
  middlewares?: MiddlewareHandler[];
  routes: Route[];
}

export interface RouterOptions {
  /** Case-sensitive routing */
  caseSensitive?: boolean;
  /** Trailing slash handling */
  trailingSlash?: 'ignore' | 'require' | 'remove';
  /** Enable route caching */
  cache?: boolean;
}

// ============================================
// Controller Types
// ============================================

export interface ControllerMeta {
  prefix: string;
  middlewares: MiddlewareHandler[];
  routes: Map<string, { method: HttpMethod; path: string; middlewares: MiddlewareHandler[] }>;
}

export type ControllerAction = (req: CanxRequest, res: CanxResponse) => Promise<Response> | Response;

// ============================================
// Model / ORM Types
// ============================================

export type DatabaseDriver = 'mysql' | 'postgresql' | 'sqlite';

export interface DatabaseConfig {
  driver: DatabaseDriver;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  pool?: {
    min?: number;
    max?: number;
    idle?: number;
  };
  /** Enable query logging */
  logging?: boolean;
  /** SSL configuration */
  ssl?: boolean | object;
}

export interface ModelField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'text' | 'binary';
  primary?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  default?: unknown;
  unique?: boolean;
  index?: boolean;
  references?: {
    model: string;
    key: string;
  };
}

export interface ModelSchema {
  table: string;
  fields: ModelField[];
  timestamps?: boolean;
  softDeletes?: boolean;
}

export interface QueryBuilder<T> {
  select: (...columns: (keyof T | '*')[]) => QueryBuilder<T>;
  where: (column: keyof T, operator: string, value: unknown) => QueryBuilder<T>;
  whereIn: (column: keyof T, values: unknown[]) => QueryBuilder<T>;
  whereNull: (column: keyof T) => QueryBuilder<T>;
  whereNotNull: (column: keyof T) => QueryBuilder<T>;
  whereRaw: (sql: string, bindings?: unknown[]) => QueryBuilder<T>;
  orWhere: (column: keyof T, operator: string, value: unknown) => QueryBuilder<T>;
  orderBy: (column: keyof T, direction?: 'asc' | 'desc') => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  offset: (count: number) => QueryBuilder<T>;
  join: (table: string, first: string, operator: string, second: string) => QueryBuilder<T>;
  leftJoin: (table: string, first: string, operator: string, second: string) => QueryBuilder<T>;
  groupBy: (...columns: (keyof T)[]) => QueryBuilder<T>;
  having: (column: keyof T, operator: string, value: unknown) => QueryBuilder<T>;
  get: () => Promise<T[]>;
  first: () => Promise<T | null>;
  count: () => Promise<number>;
  sum: (column: keyof T) => Promise<number>;
  avg: (column: keyof T) => Promise<number>;
  insert: (data: Partial<T> | Partial<T>[]) => Promise<T>;
  update: (data: Partial<T>) => Promise<number>;
  delete: () => Promise<number>;
  raw: (sql: string, bindings?: unknown[]) => Promise<unknown>;
  with: (...relations: string[]) => QueryBuilder<T>;
}

export interface RelationInfo {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';
  relatedClass: any;
  foreignKey: string;
  localKey?: string;
  ownerKey?: string;
  pivotTable?: string;
  foreignPivotKey?: string;
  relatedPivotKey?: string;
}

// ============================================
// View / JSX Types
// ============================================

export interface ViewContext {
  [key: string]: unknown;
}

export interface LayoutProps {
  children: JSX.Element;
  title?: string;
  meta?: Record<string, string>;
}

// ============================================
// Server Types
// ============================================

export interface ServerConfig {
  port?: number;
  hostname?: string;
  /** Enable development mode */
  development?: boolean;
  /** Static files directory */
  static?: string | false;
  /** Maximum request body size */
  maxBodySize?: number;
  /** Request timeout in ms */
  timeout?: number;
  /** Enable compression */
  compression?: boolean;
  /** CORS configuration */
  cors?: CorsConfig | boolean;
  /** SSL/TLS configuration */
  tls?: TlsConfig;
  /** Trusted proxy IPs */
  trustProxy?: boolean | string[];
}

export interface CorsConfig {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: HttpMethod[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export interface TlsConfig {
  cert: string;
  key: string;
  ca?: string;
  passphrase?: string;
}

// ============================================
// Cache Types
// ============================================

export interface CacheDriver {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<boolean>;
  has: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
  many: <T>(keys: string[]) => Promise<Map<string, T | null>>;
  setMany: <T>(items: Map<string, T>, ttl?: number) => Promise<void>;
}

export interface AutoCacheConfig {
  /** Enable auto-caching */
  enabled?: boolean;
  /** Default TTL in seconds */
  defaultTtl?: number;
  /** Routes to exclude from caching */
  exclude?: string[];
  /** Cache key generator */
  keyGenerator?: (req: CanxRequest) => string;
}

// ============================================
// HotWire Types
// ============================================

export interface HotWireConfig {
  /** Enable HotWire protocol */
  enabled?: boolean;
  /** Reconnect interval in ms */
  reconnectInterval?: number;
  /** Maximum connections per client */
  maxConnections?: number;
}

export interface HotWireStream {
  send: (data: string | object) => void;
  sendHTML: (html: string, target: string, action?: 'replace' | 'append' | 'prepend') => void;
  close: () => void;
  onClose: (callback: () => void) => void;
}

// ============================================
// Validation Types
// ============================================

export type ValidationRule = 
  | 'required'
  | 'string'
  | 'number'
  | 'boolean'
  | 'email'
  | 'url'
  | 'uuid'
  | 'date'
  | 'array'
  | 'object'
  | `min:${number}`
  | `max:${number}`
  | `length:${number}`
  | `regex:${string}`
  | `in:${string}`
  | `notIn:${string}`
  | `same:${string}`
  | `different:${string}`;

export interface ValidationSchema {
  [field: string]: ValidationRule | ValidationRule[] | string | {
    rules: ValidationRule[];
    messages?: Record<string, string>;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: Map<string, string[]>;
  data: Record<string, unknown>;
}

// ============================================
// Application Types
// ============================================

export interface CanxApplication {
  /** Server configuration */
  config: ServerConfig;
  /** Router instance */
  router: RouterInstance;
  /** Register global middleware */
  use: (middleware: MiddlewareHandler) => CanxApplication;
  /** Register routes */
  routes: (callback: (router: RouterInstance) => void) => CanxApplication;
  /** Register controller */
  controller: (controller: new () => unknown) => CanxApplication;
  /** Start server */
  listen: (port?: number, callback?: () => void) => Promise<void>;
  /** Stop server */
  close: () => Promise<void>;
}

export type RouteHandlerOrTuple = MiddlewareHandler | RouteHandler | [any, string];

export interface RouterInstance {
  get: (path: string, ...handlers: RouteHandlerOrTuple[]) => RouterInstance;
  post: (path: string, ...handlers: RouteHandlerOrTuple[]) => RouterInstance;
  put: (path: string, ...handlers: RouteHandlerOrTuple[]) => RouterInstance;
  patch: (path: string, ...handlers: RouteHandlerOrTuple[]) => RouterInstance;
  delete: (path: string, ...handlers: RouteHandlerOrTuple[]) => RouterInstance;
  options: (path: string, ...handlers: RouteHandlerOrTuple[]) => RouterInstance;
  head: (path: string, ...handlers: RouteHandlerOrTuple[]) => RouterInstance;
  all: (path: string, ...handlers: RouteHandlerOrTuple[]) => RouterInstance;
  group: (prefix: string, callback: (router: RouterInstance) => void) => RouterInstance;
  middleware: (...handlers: MiddlewareHandler[]) => RouterInstance;
  /** Register a controller class */
  controller: (path: string, controller: any) => RouterInstance;
  /** Name the last route */
  name: (name: string) => RouterInstance;
  /** Generate URL */
  url: (name: string, params?: Record<string, any>) => string;
}

// ============================================
// Event Types
// ============================================

export type ApplicationEvent = 
  | 'server:start'
  | 'server:stop'
  | 'request:start'
  | 'request:end'
  | 'request:error'
  | 'database:connect'
  | 'database:disconnect'
  | 'cache:hit'
  | 'cache:miss';

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

// ============================================
// Plugin Types
// ============================================

export interface Plugin {
  name: string;
  version?: string;
  install: (app: CanxApplication) => void | Promise<void>;
}

// ============================================
// CLI Types
// ============================================

export interface ProjectTemplate {
  name: string;
  description: string;
  files: Map<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface CliOptions {
  template?: 'api' | 'mvc' | 'microservice';
  database?: DatabaseDriver;
  git?: boolean;
  install?: boolean;
}

// ============================================
// Mail Types
// ============================================

export interface MailAddress {
  email: string;
  name?: string;
}

export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: 'base64' | '7bit' | '8bit' | 'binary';
}

export interface MailMessage {
  from?: MailAddress | string;
  to: (MailAddress | string)[];
  cc?: (MailAddress | string)[];
  bcc?: (MailAddress | string)[];
  replyTo?: MailAddress | string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
  headers?: Record<string, string>;
}

export interface MailConfig {
  transport: 'smtp' | 'sendgrid' | 'resend' | 'log';
  from?: MailAddress | string;
  smtp?: {
    host: string;
    port: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
  };
  sendgrid?: { apiKey: string };
  resend?: { apiKey: string };
}

// ============================================
// Notification Types
// ============================================

export type NotificationChannel = 'mail' | 'database' | 'broadcast' | 'sms' | 'slack' | 'push';

export interface Notifiable {
  id: string | number;
  email?: string;
  phone?: string;
  routeNotificationFor(channel: NotificationChannel): string | undefined;
}

// ============================================
// Storage Types
// ============================================

export interface StorageDriver {
  put(path: string, content: Buffer | string | Blob): Promise<string>;
  get(path: string): Promise<Buffer>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<boolean>;
  copy(from: string, to: string): Promise<boolean>;
  move(from: string, to: string): Promise<boolean>;
  url(path: string): string;
  temporaryUrl(path: string, expiresIn: number): Promise<string>;
  metadata(path: string): Promise<FileMetadata>;
  files(directory: string): Promise<string[]>;
  allFiles(directory: string): Promise<string[]>;
  makeDirectory(path: string): Promise<boolean>;
  deleteDirectory(path: string): Promise<boolean>;
  append(path: string, content: string | Buffer): Promise<boolean>;
  prepend(path: string, content: string | Buffer): Promise<boolean>;
}

export interface FileMetadata {
  path: string;
  size: number;
  mimeType: string;
  lastModified: Date;
  etag?: string;
}

export interface StorageConfig {
  default?: string;
  disks?: {
    local?: { root: string; urlPrefix?: string };
    s3?: {
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      endpoint?: string;
      forcePathStyle?: boolean;
      urlPrefix?: string;
    };
    [key: string]: unknown;
  };
}

// ============================================
// Container / DI Types
// ============================================

export interface ServiceProvider {
  register(container: unknown): void | Promise<void>;
  boot?(container: unknown): void | Promise<void>;
}

// ============================================
// Health Check Types
// ============================================

export type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version?: string;
  checks: HealthCheckResult[];
}

export type HealthChecker = () => Promise<HealthCheckResult>;

// ============================================
// i18n Types
// ============================================

export type TranslationValue = string | TranslationObject;

export interface TranslationObject {
  [key: string]: TranslationValue;
}

export interface I18nConfig {
  defaultLocale: string;
  fallbackLocale?: string;
  locales: string[];
  directory?: string;
  autoDetect?: boolean;
}

// ============================================
// Logger Types
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogTransport {
  name: string;
  log: (entry: LogEntry) => void | Promise<void>;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  requestId?: string;
  duration?: number;
}

// ============================================
// WebSocket Types
// ============================================

export interface WebSocketData {
  id: string;
  userId?: string | number;
  rooms: Set<string>;
  metadata: Record<string, unknown>;
}

export interface WebSocketConfig {
  path?: string;
  maxPayloadLength?: number;
  idleTimeout?: number;
  backpressureLimit?: number;
  compression?: boolean;
}


// ============================================
// JSX / View Types
// ============================================

export declare namespace Canx {
    namespace JSX {
        interface Element extends String {}
        interface IntrinsicElements {
            [elemName: string]: any;
        }
    }
}
