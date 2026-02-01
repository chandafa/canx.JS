"use strict";
/**
 * CanxJS - Ultra-fast async-first MVC backend framework for Bun
 * @version 1.0.0
 * @license MIT
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.html = exports.Fragment = exports.jsxs = exports.jsx = exports.execute = exports.query = exports.closeDatabase = exports.initDatabase = exports.QueryBuilderImpl = exports.Model = exports.wrapWithParamResolution = exports.getControllerMeta = exports.Validate = exports.Middleware = exports.Head = exports.Options = exports.Delete = exports.Patch = exports.Put = exports.Post = exports.Get = exports.Controller = exports.BaseController = exports.TestClient = exports.ClientGenerator = exports.ZSchema = exports.z = exports.SessionStore = exports.SessionMiddleware = exports.csrfMeta = exports.csrfField = exports.csrf = exports.validateSchema = exports.security = exports.createMiddlewarePipeline = exports.serveStatic = exports.compress = exports.rateLimit = exports.bodyParser = exports.logger = exports.cors = exports.MiddlewarePipeline = exports.ErrorHandler = exports.Action = exports.defineConfig = exports.createApp = exports.Canx = exports.Router = exports.CanxServer = exports.Server = void 0;
exports.verifyPassword = exports.hashPassword = exports.auth = exports.Scheduler = exports.createScheduler = exports.scheduler = exports.JITCompiler = exports.createJITCompiler = exports.jitCompiler = exports.createBatcher = exports.RequestBatcher = exports.createAutoCache = exports.autoCacheMiddleware = exports.autoCache = exports.createHotWire = exports.hotWire = exports.ZodValidationPipe = exports.ParseArrayPipe = exports.ParamDefaultValuePipe = exports.UpperCasePipe = exports.LowerCasePipe = exports.ParamTrimPipe = exports.ParseJsonPipe = exports.ParseUUIDPipe = exports.ParamParseBoolPipe = exports.ParamParseFloatPipe = exports.ParamParseIntPipe = exports.resolveParams = exports.resolveParam = exports.getParamMetadata = exports.createCustomParamDecorator = exports.UploadedFiles = exports.UploadedFile = exports.Session = exports.Ip = exports.User = exports.Response = exports.Res = exports.Request = exports.Req = exports.Headers = exports.Query = exports.Param = exports.Body = exports.viewExists = exports.view = exports.View = exports.createLayout = exports.renderPage = exports.render = void 0;
exports.TaggedCacheScope = exports.TaggedCache = exports.transformCollection = exports.transformResource = exports.resourceMergeWhen = exports.resourceWhenNotNull = exports.resourceWhen = exports.paginatedResource = exports.ApiResourceCollection = exports.ApiResource = exports.queryVersioning = exports.headerVersioning = exports.urlVersioning = exports.stripVersionPrefix = exports.getVersion = exports.Version = exports.versionedHandler = exports.versioning = exports.AuthManager = exports.JwtGuard = exports.TokenGuard = exports.SessionGuard = exports.guestOnly = exports.requireAuth = exports.authMiddleware = exports.initAuth = exports.authManager = exports.AuthorizationException = exports.UserGate = exports.Gate = exports.canAny = exports.cannot = exports.can = exports.authorize = exports.denies = exports.allows = exports.registerPolicy = exports.definePolicy = exports.defineGate = exports.gate = exports.DatabaseSessionDriver = exports.sessionStore = exports.sessionAuth = exports.roles = exports.guest = exports.protect = exports.optionalAuth = exports.jwtAuth = exports.verifyJWT = exports.signJWT = void 0;
exports.UseInterceptors = exports.UseGuards = exports.applyExceptionFilters = exports.createExceptionFilter = exports.DefaultValuePipe = exports.TrimPipe = exports.ParseBoolPipe = exports.ParseFloatPipe = exports.ParseIntPipe = exports.createAopPipe = exports.applyInterceptors = exports.createInterceptor = exports.applyGuards = exports.createGuard = exports.isDynamicModule = exports.getLazyModuleLoader = exports.isLazyModule = exports.LazyModule = exports.isGlobalModule = exports.Global = exports.createModuleContainer = exports.getInjectMetadata = exports.ModInject = exports.isModInjectable = exports.ModInjectable = exports.getModuleMetadata = exports.CanxModule = exports.ModuleContainer = exports.Module = exports.transform = exports.unless = exports.pipeWhen = exports.tap = exports.createPipe = exports.pipeline = exports.Pipeline = exports.initKernel = exports.kernel = exports.ApplicationKernel = exports.DeferredServiceProvider = exports.ServiceProvider = exports.AppServiceProvider = exports.configEnv = exports.config = exports.initConfig = exports.ConfigManager = exports.createCache = exports.cache = exports.initCache = exports.MemoryCacheDriver = void 0;
exports.ScopedContainer = exports.Container = exports.Inject = exports.Injectable = exports.resolve = exports.singleton = exports.bind = exports.container = exports.makeNotifiable = exports.Notification = exports.notifyMany = exports.notify = exports.notifications = exports.MailBuilder = exports.Mailer = exports.sendMail = exports.mail = exports.initMail = exports.EventServiceProvider = exports.getEventListeners = exports.Listen = exports.EventEmitter = exports.createEventEmitter = exports.events = exports.S3Driver = exports.LocalDriver = exports.handleMultipleUploads = exports.handleUpload = exports.initStorage = exports.storage = exports.WebSocketServer = exports.createWebSocketServer = exports.ws = exports.createChannel = exports.channel = exports.QueueController = exports.MemoryDriver = exports.RedisDriver = exports.createQueue = exports.queue = exports.defineSeeder = exports.seederFactory = exports.fake = exports.seeder = exports.defineMigration = exports.migrator = exports.Schema = exports.getInterceptorMetadata = exports.getGuardMetadata = exports.UsePipes = void 0;
exports.isDevelopment = exports.isProduction = exports.env = exports.parseRequest = exports.RequestParser = exports.response = exports.ResponseBuilder = exports.TestCase = exports.createHttpTest = exports.DatabaseTest = exports.HttpTest = exports.setMessage = exports.extendParam = exports.extendAsync = exports.extend = exports.is = exports.validateAsync = exports.validate = exports.QueryParams = exports.parseQuery = exports.QueryParser = exports.MemoryStore = exports.RedisStore = exports.createRedisStore = exports.createCacheStore = exports.createMemoryStore = exports.createRateLimiter = exports.RateLimiter = exports.HealthCheckError = exports.DiskHealthIndicator = exports.MemoryHealthIndicator = exports.DatabaseHealthIndicator = exports.HealthIndicator = exports.HealthCheckService = exports.HealthModule = exports.createHttp2Middleware = exports.startHttp2 = exports.createHttp2Server = exports.Http2Server = exports.clearRequestContext = exports.getRequestId = exports.setRequestContext = exports.runWithRequestId = exports.runInRequestContext = exports.requestScopeMiddleware = exports.AutoWire = exports.Scope = exports.isForwardRef = exports.forwardRef = exports.containerMiddleware = void 0;
exports.t = exports.useI18n = exports.initI18n = exports.createHealthManager = exports.healthRoutes = exports.customCheck = exports.redisCheck = exports.httpCheck = exports.diskCheck = exports.memoryCheck = exports.databaseCheck = exports.metrics = exports.health = exports.createFileTransport = exports.requestLogger = exports.Logger = exports.createLogger = exports.log = exports.errors = exports.assertValid = exports.assertAuthorized = exports.assertAuthenticated = exports.assertFound = exports.asyncHandler = exports.errorHandler = exports.ServiceUnavailableError = exports.DatabaseError = exports.BadRequestError = exports.RateLimitError = exports.ConflictError = exports.AuthorizationError = exports.AuthenticationError = exports.NotFoundError = exports.ValidationError = exports.CanxError = exports.InternalServerException = exports.ServiceUnavailableException = exports.TooManyRequestsException = exports.ConflictException = exports.BadRequestException = exports.MethodNotAllowedException = exports.ForbiddenException = exports.UnauthorizedException = exports.ViewNotFoundException = exports.ValidationException = exports.NotFoundException = exports.HttpException = exports.CanxException = exports.requireEnv = exports.isTest = void 0;
exports.randomString = exports.factory = exports.assertResponse = exports.createTestClient = exports.MockFactory = exports.ResponseAssertions = exports.times = exports.range = exports.collect = exports.Collection = exports.mergeWhen = exports.whenLoaded = exports.whenNotNull = exports.when = exports.error = exports.success = exports.wrap = exports.resourceCollection = exports.resource = exports.AnonymousResource = exports.ResourceCollection = exports.Resource = exports.JsonResource = exports.ValidateWith = exports.createFormRequest = exports.getFormRequest = exports.validated = exports.formRequest = exports.FormRequest = exports.cursorPaginate = exports.simplePaginate = exports.paginate = exports.CursorPaginator = exports.SimplePaginator = exports.Paginator = exports.Encrypt = exports.deriveKey = exports.generateKey = exports.decrypt = exports.encrypt = exports.initEncrypt = exports.encryptor = exports.Hash = exports.needsRehash = exports.hashCheck = exports.hashMake = exports.hash = exports.i18nMiddleware = exports.I18n = exports.plural = void 0;
exports.AsyncApiMessage = exports.AsyncApiChannel = exports.AsyncApiGenerator = exports.DevToolsModule = exports.Trace = exports.TracingModule = exports.TestingModuleBuilder = exports.Test = exports.GatewayManager = exports.GATEWAY_METADATA = exports.ConnectedSocket = exports.MessageBody = exports.SubscribeMessage = exports.WebSocketGateway = exports.default = exports.sleep = exports.randomUuid = exports.randomNumber = exports.randomEmail = void 0;
// ============================================
// Core Exports
// ============================================
// Core Exports
var Server_1 = require("./core/Server");
Object.defineProperty(exports, "Server", { enumerable: true, get: function () { return Server_1.Server; } });
Object.defineProperty(exports, "CanxServer", { enumerable: true, get: function () { return Server_1.Server; } });
var Router_1 = require("./core/Router");
Object.defineProperty(exports, "Router", { enumerable: true, get: function () { return Router_1.Router; } });
var Application_1 = require("./Application");
Object.defineProperty(exports, "Canx", { enumerable: true, get: function () { return Application_1.Canx; } });
Object.defineProperty(exports, "createApp", { enumerable: true, get: function () { return Application_1.createApp; } });
Object.defineProperty(exports, "defineConfig", { enumerable: true, get: function () { return Application_1.defineConfig; } });
var Action_1 = require("./core/Action");
Object.defineProperty(exports, "Action", { enumerable: true, get: function () { return Action_1.Action; } });
var ErrorHandler_1 = require("./core/ErrorHandler");
Object.defineProperty(exports, "ErrorHandler", { enumerable: true, get: function () { return ErrorHandler_1.ErrorHandler; } });
// ============================================
// Middleware Exports
// ============================================
var Middleware_1 = require("./core/Middleware");
Object.defineProperty(exports, "MiddlewarePipeline", { enumerable: true, get: function () { return Middleware_1.MiddlewarePipeline; } });
Object.defineProperty(exports, "cors", { enumerable: true, get: function () { return Middleware_1.cors; } });
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return Middleware_1.logger; } });
Object.defineProperty(exports, "bodyParser", { enumerable: true, get: function () { return Middleware_1.bodyParser; } });
Object.defineProperty(exports, "rateLimit", { enumerable: true, get: function () { return Middleware_1.rateLimit; } });
Object.defineProperty(exports, "compress", { enumerable: true, get: function () { return Middleware_1.compress; } });
Object.defineProperty(exports, "serveStatic", { enumerable: true, get: function () { return Middleware_1.serveStatic; } });
Object.defineProperty(exports, "createMiddlewarePipeline", { enumerable: true, get: function () { return Middleware_1.createMiddlewarePipeline; } });
var SecurityMiddleware_1 = require("./middlewares/SecurityMiddleware");
Object.defineProperty(exports, "security", { enumerable: true, get: function () { return SecurityMiddleware_1.security; } });
var ValidationMiddleware_1 = require("./middlewares/ValidationMiddleware");
Object.defineProperty(exports, "validateSchema", { enumerable: true, get: function () { return ValidationMiddleware_1.validateSchema; } });
var CsrfMiddleware_1 = require("./middlewares/CsrfMiddleware");
Object.defineProperty(exports, "csrf", { enumerable: true, get: function () { return CsrfMiddleware_1.csrf; } });
Object.defineProperty(exports, "csrfField", { enumerable: true, get: function () { return CsrfMiddleware_1.csrfField; } });
Object.defineProperty(exports, "csrfMeta", { enumerable: true, get: function () { return CsrfMiddleware_1.csrfMeta; } });
var SessionMiddleware_1 = require("./middlewares/SessionMiddleware");
Object.defineProperty(exports, "SessionMiddleware", { enumerable: true, get: function () { return SessionMiddleware_1.SessionMiddleware; } });
var Session_1 = require("./core/Session");
Object.defineProperty(exports, "SessionStore", { enumerable: true, get: function () { return Session_1.Session; } });
// ============================================
// Schema / Validation Exports
// ============================================
var Schema_1 = require("./schema/Schema");
Object.defineProperty(exports, "z", { enumerable: true, get: function () { return Schema_1.z; } });
Object.defineProperty(exports, "ZSchema", { enumerable: true, get: function () { return Schema_1.Schema; } });
var ClientGenerator_1 = require("./generator/ClientGenerator");
Object.defineProperty(exports, "ClientGenerator", { enumerable: true, get: function () { return ClientGenerator_1.ClientGenerator; } });
var TestClient_1 = require("./testing/TestClient");
Object.defineProperty(exports, "TestClient", { enumerable: true, get: function () { return TestClient_1.TestClient; } });
// ============================================
// MVC Exports
// ============================================
var Controller_1 = require("./mvc/Controller");
Object.defineProperty(exports, "BaseController", { enumerable: true, get: function () { return Controller_1.BaseController; } });
Object.defineProperty(exports, "Controller", { enumerable: true, get: function () { return Controller_1.Controller; } });
Object.defineProperty(exports, "Get", { enumerable: true, get: function () { return Controller_1.Get; } });
Object.defineProperty(exports, "Post", { enumerable: true, get: function () { return Controller_1.Post; } });
Object.defineProperty(exports, "Put", { enumerable: true, get: function () { return Controller_1.Put; } });
Object.defineProperty(exports, "Patch", { enumerable: true, get: function () { return Controller_1.Patch; } });
Object.defineProperty(exports, "Delete", { enumerable: true, get: function () { return Controller_1.Delete; } });
Object.defineProperty(exports, "Options", { enumerable: true, get: function () { return Controller_1.Options; } });
Object.defineProperty(exports, "Head", { enumerable: true, get: function () { return Controller_1.Head; } });
Object.defineProperty(exports, "Middleware", { enumerable: true, get: function () { return Controller_1.Middleware; } });
Object.defineProperty(exports, "Validate", { enumerable: true, get: function () { return Controller_1.Validate; } });
Object.defineProperty(exports, "getControllerMeta", { enumerable: true, get: function () { return Controller_1.getControllerMeta; } });
Object.defineProperty(exports, "wrapWithParamResolution", { enumerable: true, get: function () { return Controller_1.wrapWithParamResolution; } });
var Model_1 = require("./mvc/Model");
Object.defineProperty(exports, "Model", { enumerable: true, get: function () { return Model_1.Model; } });
Object.defineProperty(exports, "QueryBuilderImpl", { enumerable: true, get: function () { return Model_1.QueryBuilderImpl; } });
Object.defineProperty(exports, "initDatabase", { enumerable: true, get: function () { return Model_1.initDatabase; } });
Object.defineProperty(exports, "closeDatabase", { enumerable: true, get: function () { return Model_1.closeDatabase; } });
Object.defineProperty(exports, "query", { enumerable: true, get: function () { return Model_1.query; } });
Object.defineProperty(exports, "execute", { enumerable: true, get: function () { return Model_1.execute; } });
var View_1 = require("./mvc/View");
Object.defineProperty(exports, "jsx", { enumerable: true, get: function () { return View_1.jsx; } });
Object.defineProperty(exports, "jsxs", { enumerable: true, get: function () { return View_1.jsxs; } });
Object.defineProperty(exports, "Fragment", { enumerable: true, get: function () { return View_1.Fragment; } });
Object.defineProperty(exports, "html", { enumerable: true, get: function () { return View_1.html; } });
Object.defineProperty(exports, "render", { enumerable: true, get: function () { return View_1.render; } });
Object.defineProperty(exports, "renderPage", { enumerable: true, get: function () { return View_1.renderPage; } });
Object.defineProperty(exports, "createLayout", { enumerable: true, get: function () { return View_1.createLayout; } });
Object.defineProperty(exports, "View", { enumerable: true, get: function () { return View_1.View; } });
Object.defineProperty(exports, "view", { enumerable: true, get: function () { return View_1.view; } });
Object.defineProperty(exports, "viewExists", { enumerable: true, get: function () { return View_1.viewExists; } });
// ============================================
// Parameter Decorators
// ============================================
var Decorators_1 = require("./core/Decorators");
Object.defineProperty(exports, "Body", { enumerable: true, get: function () { return Decorators_1.Body; } });
Object.defineProperty(exports, "Param", { enumerable: true, get: function () { return Decorators_1.Param; } });
Object.defineProperty(exports, "Query", { enumerable: true, get: function () { return Decorators_1.Query; } });
Object.defineProperty(exports, "Headers", { enumerable: true, get: function () { return Decorators_1.Headers; } });
Object.defineProperty(exports, "Req", { enumerable: true, get: function () { return Decorators_1.Req; } });
Object.defineProperty(exports, "Request", { enumerable: true, get: function () { return Decorators_1.Request; } });
Object.defineProperty(exports, "Res", { enumerable: true, get: function () { return Decorators_1.Res; } });
Object.defineProperty(exports, "Response", { enumerable: true, get: function () { return Decorators_1.Response; } });
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return Decorators_1.User; } });
Object.defineProperty(exports, "Ip", { enumerable: true, get: function () { return Decorators_1.Ip; } });
Object.defineProperty(exports, "Session", { enumerable: true, get: function () { return Decorators_1.Session; } });
Object.defineProperty(exports, "UploadedFile", { enumerable: true, get: function () { return Decorators_1.UploadedFile; } });
Object.defineProperty(exports, "UploadedFiles", { enumerable: true, get: function () { return Decorators_1.UploadedFiles; } });
Object.defineProperty(exports, "createCustomParamDecorator", { enumerable: true, get: function () { return Decorators_1.createCustomParamDecorator; } });
Object.defineProperty(exports, "getParamMetadata", { enumerable: true, get: function () { return Decorators_1.getParamMetadata; } });
Object.defineProperty(exports, "resolveParam", { enumerable: true, get: function () { return Decorators_1.resolveParam; } });
Object.defineProperty(exports, "resolveParams", { enumerable: true, get: function () { return Decorators_1.resolveParams; } });
// Built-in pipes
Object.defineProperty(exports, "ParamParseIntPipe", { enumerable: true, get: function () { return Decorators_1.ParseIntPipe; } });
Object.defineProperty(exports, "ParamParseFloatPipe", { enumerable: true, get: function () { return Decorators_1.ParseFloatPipe; } });
Object.defineProperty(exports, "ParamParseBoolPipe", { enumerable: true, get: function () { return Decorators_1.ParseBoolPipe; } });
Object.defineProperty(exports, "ParseUUIDPipe", { enumerable: true, get: function () { return Decorators_1.ParseUUIDPipe; } });
Object.defineProperty(exports, "ParseJsonPipe", { enumerable: true, get: function () { return Decorators_1.ParseJsonPipe; } });
Object.defineProperty(exports, "ParamTrimPipe", { enumerable: true, get: function () { return Decorators_1.TrimPipe; } });
Object.defineProperty(exports, "LowerCasePipe", { enumerable: true, get: function () { return Decorators_1.LowerCasePipe; } });
Object.defineProperty(exports, "UpperCasePipe", { enumerable: true, get: function () { return Decorators_1.UpperCasePipe; } });
Object.defineProperty(exports, "ParamDefaultValuePipe", { enumerable: true, get: function () { return Decorators_1.DefaultValuePipe; } });
Object.defineProperty(exports, "ParseArrayPipe", { enumerable: true, get: function () { return Decorators_1.ParseArrayPipe; } });
Object.defineProperty(exports, "ZodValidationPipe", { enumerable: true, get: function () { return Decorators_1.ZodValidationPipe; } });
// ============================================
// Feature Exports
// ============================================
var HotWire_1 = require("./features/HotWire");
Object.defineProperty(exports, "hotWire", { enumerable: true, get: function () { return HotWire_1.hotWire; } });
Object.defineProperty(exports, "createHotWire", { enumerable: true, get: function () { return HotWire_1.createHotWire; } });
var AutoCache_1 = require("./features/AutoCache");
Object.defineProperty(exports, "autoCache", { enumerable: true, get: function () { return AutoCache_1.autoCache; } });
Object.defineProperty(exports, "autoCacheMiddleware", { enumerable: true, get: function () { return AutoCache_1.autoCacheMiddleware; } });
Object.defineProperty(exports, "createAutoCache", { enumerable: true, get: function () { return AutoCache_1.createAutoCache; } });
var RequestBatcher_1 = require("./features/RequestBatcher");
Object.defineProperty(exports, "RequestBatcher", { enumerable: true, get: function () { return RequestBatcher_1.RequestBatcher; } });
Object.defineProperty(exports, "createBatcher", { enumerable: true, get: function () { return RequestBatcher_1.createBatcher; } });
var JITCompiler_1 = require("./features/JITCompiler");
Object.defineProperty(exports, "jitCompiler", { enumerable: true, get: function () { return JITCompiler_1.jitCompiler; } });
Object.defineProperty(exports, "createJITCompiler", { enumerable: true, get: function () { return JITCompiler_1.createJITCompiler; } });
Object.defineProperty(exports, "JITCompiler", { enumerable: true, get: function () { return JITCompiler_1.JITCompiler; } });
var Scheduler_1 = require("./features/Scheduler");
Object.defineProperty(exports, "scheduler", { enumerable: true, get: function () { return Scheduler_1.scheduler; } });
Object.defineProperty(exports, "createScheduler", { enumerable: true, get: function () { return Scheduler_1.createScheduler; } });
Object.defineProperty(exports, "Scheduler", { enumerable: true, get: function () { return Scheduler_1.Scheduler; } });
// ============================================
// Auth Exports (Core Only)
// ============================================
var Auth_1 = require("./auth/Auth");
Object.defineProperty(exports, "auth", { enumerable: true, get: function () { return Auth_1.auth; } });
Object.defineProperty(exports, "hashPassword", { enumerable: true, get: function () { return Auth_1.hashPassword; } });
Object.defineProperty(exports, "verifyPassword", { enumerable: true, get: function () { return Auth_1.verifyPassword; } });
Object.defineProperty(exports, "signJWT", { enumerable: true, get: function () { return Auth_1.signJWT; } });
Object.defineProperty(exports, "verifyJWT", { enumerable: true, get: function () { return Auth_1.verifyJWT; } });
Object.defineProperty(exports, "jwtAuth", { enumerable: true, get: function () { return Auth_1.jwtAuth; } });
Object.defineProperty(exports, "optionalAuth", { enumerable: true, get: function () { return Auth_1.optionalAuth; } });
Object.defineProperty(exports, "protect", { enumerable: true, get: function () { return Auth_1.protect; } });
Object.defineProperty(exports, "guest", { enumerable: true, get: function () { return Auth_1.guest; } });
Object.defineProperty(exports, "roles", { enumerable: true, get: function () { return Auth_1.roles; } });
Object.defineProperty(exports, "sessionAuth", { enumerable: true, get: function () { return Auth_1.sessionAuth; } });
Object.defineProperty(exports, "sessionStore", { enumerable: true, get: function () { return Auth_1.sessionStore; } });
Object.defineProperty(exports, "DatabaseSessionDriver", { enumerable: true, get: function () { return Auth_1.DatabaseSessionDriver; } });
// Authorization (Gates & Policies)
var Gate_1 = require("./auth/Gate");
Object.defineProperty(exports, "gate", { enumerable: true, get: function () { return Gate_1.gate; } });
Object.defineProperty(exports, "defineGate", { enumerable: true, get: function () { return Gate_1.defineGate; } });
Object.defineProperty(exports, "definePolicy", { enumerable: true, get: function () { return Gate_1.definePolicy; } });
Object.defineProperty(exports, "registerPolicy", { enumerable: true, get: function () { return Gate_1.registerPolicy; } });
Object.defineProperty(exports, "allows", { enumerable: true, get: function () { return Gate_1.allows; } });
Object.defineProperty(exports, "denies", { enumerable: true, get: function () { return Gate_1.denies; } });
Object.defineProperty(exports, "authorize", { enumerable: true, get: function () { return Gate_1.authorize; } });
Object.defineProperty(exports, "can", { enumerable: true, get: function () { return Gate_1.can; } });
Object.defineProperty(exports, "cannot", { enumerable: true, get: function () { return Gate_1.cannot; } });
Object.defineProperty(exports, "canAny", { enumerable: true, get: function () { return Gate_1.canAny; } });
Object.defineProperty(exports, "Gate", { enumerable: true, get: function () { return Gate_1.Gate; } });
Object.defineProperty(exports, "UserGate", { enumerable: true, get: function () { return Gate_1.UserGate; } });
Object.defineProperty(exports, "AuthorizationException", { enumerable: true, get: function () { return Gate_1.AuthorizationException; } });
// Auth Guards
var Guard_1 = require("./auth/Guard");
Object.defineProperty(exports, "authManager", { enumerable: true, get: function () { return Guard_1.authManager; } });
Object.defineProperty(exports, "initAuth", { enumerable: true, get: function () { return Guard_1.initAuth; } });
Object.defineProperty(exports, "authMiddleware", { enumerable: true, get: function () { return Guard_1.authMiddleware; } });
Object.defineProperty(exports, "requireAuth", { enumerable: true, get: function () { return Guard_1.requireAuth; } });
Object.defineProperty(exports, "guestOnly", { enumerable: true, get: function () { return Guard_1.guestOnly; } });
Object.defineProperty(exports, "SessionGuard", { enumerable: true, get: function () { return Guard_1.SessionGuard; } });
Object.defineProperty(exports, "TokenGuard", { enumerable: true, get: function () { return Guard_1.TokenGuard; } });
Object.defineProperty(exports, "JwtGuard", { enumerable: true, get: function () { return Guard_1.JwtGuard; } });
Object.defineProperty(exports, "AuthManager", { enumerable: true, get: function () { return Guard_1.AuthManager; } });
// NOTE: OAuth, TwoFactor, and advanced Auth features should now be imported from 'canxjs/auth'
// or their specific submodules to reduce bundle size.
// ============================================
// API Versioning Exports
// ============================================
var ApiVersioning_1 = require("./utils/ApiVersioning");
Object.defineProperty(exports, "versioning", { enumerable: true, get: function () { return ApiVersioning_1.versioning; } });
Object.defineProperty(exports, "versionedHandler", { enumerable: true, get: function () { return ApiVersioning_1.versionedHandler; } });
Object.defineProperty(exports, "Version", { enumerable: true, get: function () { return ApiVersioning_1.Version; } });
Object.defineProperty(exports, "getVersion", { enumerable: true, get: function () { return ApiVersioning_1.getVersion; } });
Object.defineProperty(exports, "stripVersionPrefix", { enumerable: true, get: function () { return ApiVersioning_1.stripVersionPrefix; } });
Object.defineProperty(exports, "urlVersioning", { enumerable: true, get: function () { return ApiVersioning_1.urlVersioning; } });
Object.defineProperty(exports, "headerVersioning", { enumerable: true, get: function () { return ApiVersioning_1.headerVersioning; } });
Object.defineProperty(exports, "queryVersioning", { enumerable: true, get: function () { return ApiVersioning_1.queryVersioning; } });
// NOTE: OpenAPI/Swagger, CQRS, Microservices, and GraphQL have been moved to their own entry points.
// Please import them from 'canxjs/microservices', 'canxjs/cqrs', 'canxjs/graphql', etc.
// ============================================
// API Resources Exports
// ============================================
var ApiResource_1 = require("./utils/ApiResource");
Object.defineProperty(exports, "ApiResource", { enumerable: true, get: function () { return ApiResource_1.Resource; } });
Object.defineProperty(exports, "ApiResourceCollection", { enumerable: true, get: function () { return ApiResource_1.ResourceCollection; } });
Object.defineProperty(exports, "paginatedResource", { enumerable: true, get: function () { return ApiResource_1.paginatedResource; } });
Object.defineProperty(exports, "resourceWhen", { enumerable: true, get: function () { return ApiResource_1.when; } });
Object.defineProperty(exports, "resourceWhenNotNull", { enumerable: true, get: function () { return ApiResource_1.whenNotNull; } });
Object.defineProperty(exports, "resourceMergeWhen", { enumerable: true, get: function () { return ApiResource_1.mergeWhen; } });
Object.defineProperty(exports, "transformResource", { enumerable: true, get: function () { return ApiResource_1.resource; } });
Object.defineProperty(exports, "transformCollection", { enumerable: true, get: function () { return ApiResource_1.collection; } });
// ============================================
// Tagged Cache Exports
// ============================================
var TaggedCache_1 = require("./cache/TaggedCache");
Object.defineProperty(exports, "TaggedCache", { enumerable: true, get: function () { return TaggedCache_1.TaggedCache; } });
Object.defineProperty(exports, "TaggedCacheScope", { enumerable: true, get: function () { return TaggedCache_1.TaggedCacheScope; } });
Object.defineProperty(exports, "MemoryCacheDriver", { enumerable: true, get: function () { return TaggedCache_1.MemoryCacheDriver; } });
Object.defineProperty(exports, "initCache", { enumerable: true, get: function () { return TaggedCache_1.initCache; } });
Object.defineProperty(exports, "cache", { enumerable: true, get: function () { return TaggedCache_1.cache; } });
Object.defineProperty(exports, "createCache", { enumerable: true, get: function () { return TaggedCache_1.createCache; } });
// ============================================
// Config Manager Exports
// ============================================
var ConfigManager_1 = require("./config/ConfigManager");
Object.defineProperty(exports, "ConfigManager", { enumerable: true, get: function () { return ConfigManager_1.ConfigManager; } });
Object.defineProperty(exports, "initConfig", { enumerable: true, get: function () { return ConfigManager_1.initConfig; } });
Object.defineProperty(exports, "config", { enumerable: true, get: function () { return ConfigManager_1.config; } });
Object.defineProperty(exports, "configEnv", { enumerable: true, get: function () { return ConfigManager_1.env; } });
// ============================================
// Service Provider Exports
// ============================================
var ServiceProvider_1 = require("./core/ServiceProvider");
Object.defineProperty(exports, "AppServiceProvider", { enumerable: true, get: function () { return ServiceProvider_1.ServiceProvider; } });
Object.defineProperty(exports, "ServiceProvider", { enumerable: true, get: function () { return ServiceProvider_1.ServiceProvider; } });
Object.defineProperty(exports, "DeferredServiceProvider", { enumerable: true, get: function () { return ServiceProvider_1.DeferredServiceProvider; } });
Object.defineProperty(exports, "ApplicationKernel", { enumerable: true, get: function () { return ServiceProvider_1.ApplicationKernel; } });
Object.defineProperty(exports, "kernel", { enumerable: true, get: function () { return ServiceProvider_1.kernel; } });
Object.defineProperty(exports, "initKernel", { enumerable: true, get: function () { return ServiceProvider_1.initKernel; } });
// ============================================
// Pipeline Exports
// ============================================
var Pipeline_1 = require("./utils/Pipeline");
Object.defineProperty(exports, "Pipeline", { enumerable: true, get: function () { return Pipeline_1.Pipeline; } });
Object.defineProperty(exports, "pipeline", { enumerable: true, get: function () { return Pipeline_1.pipeline; } });
Object.defineProperty(exports, "createPipe", { enumerable: true, get: function () { return Pipeline_1.createPipe; } });
Object.defineProperty(exports, "tap", { enumerable: true, get: function () { return Pipeline_1.tap; } });
Object.defineProperty(exports, "pipeWhen", { enumerable: true, get: function () { return Pipeline_1.when; } });
Object.defineProperty(exports, "unless", { enumerable: true, get: function () { return Pipeline_1.unless; } });
Object.defineProperty(exports, "transform", { enumerable: true, get: function () { return Pipeline_1.transform; } });
// ============================================
// Module System Exports
// ============================================
var Module_1 = require("./core/Module");
Object.defineProperty(exports, "Module", { enumerable: true, get: function () { return Module_1.Module; } });
Object.defineProperty(exports, "ModuleContainer", { enumerable: true, get: function () { return Module_1.ModuleContainer; } });
Object.defineProperty(exports, "CanxModule", { enumerable: true, get: function () { return Module_1.CanxModule; } });
Object.defineProperty(exports, "getModuleMetadata", { enumerable: true, get: function () { return Module_1.getModuleMetadata; } });
Object.defineProperty(exports, "ModInjectable", { enumerable: true, get: function () { return Module_1.Injectable; } });
Object.defineProperty(exports, "isModInjectable", { enumerable: true, get: function () { return Module_1.isInjectable; } });
Object.defineProperty(exports, "ModInject", { enumerable: true, get: function () { return Module_1.Inject; } });
Object.defineProperty(exports, "getInjectMetadata", { enumerable: true, get: function () { return Module_1.getInjectMetadata; } });
Object.defineProperty(exports, "createModuleContainer", { enumerable: true, get: function () { return Module_1.createModuleContainer; } });
// New: Dynamic Modules
Object.defineProperty(exports, "Global", { enumerable: true, get: function () { return Module_1.Global; } });
Object.defineProperty(exports, "isGlobalModule", { enumerable: true, get: function () { return Module_1.isGlobalModule; } });
Object.defineProperty(exports, "LazyModule", { enumerable: true, get: function () { return Module_1.LazyModule; } });
Object.defineProperty(exports, "isLazyModule", { enumerable: true, get: function () { return Module_1.isLazyModule; } });
Object.defineProperty(exports, "getLazyModuleLoader", { enumerable: true, get: function () { return Module_1.getLazyModuleLoader; } });
Object.defineProperty(exports, "isDynamicModule", { enumerable: true, get: function () { return Module_1.isDynamicModule; } });
// ============================================
// AOP (Aspect-Oriented Programming) Exports
// ============================================
var AOP_1 = require("./core/AOP");
Object.defineProperty(exports, "createGuard", { enumerable: true, get: function () { return AOP_1.createGuard; } });
Object.defineProperty(exports, "applyGuards", { enumerable: true, get: function () { return AOP_1.applyGuards; } });
Object.defineProperty(exports, "createInterceptor", { enumerable: true, get: function () { return AOP_1.createInterceptor; } });
Object.defineProperty(exports, "applyInterceptors", { enumerable: true, get: function () { return AOP_1.applyInterceptors; } });
Object.defineProperty(exports, "createAopPipe", { enumerable: true, get: function () { return AOP_1.createPipe; } });
Object.defineProperty(exports, "ParseIntPipe", { enumerable: true, get: function () { return AOP_1.ParseIntPipe; } });
Object.defineProperty(exports, "ParseFloatPipe", { enumerable: true, get: function () { return AOP_1.ParseFloatPipe; } });
Object.defineProperty(exports, "ParseBoolPipe", { enumerable: true, get: function () { return AOP_1.ParseBoolPipe; } });
Object.defineProperty(exports, "TrimPipe", { enumerable: true, get: function () { return AOP_1.TrimPipe; } });
Object.defineProperty(exports, "DefaultValuePipe", { enumerable: true, get: function () { return AOP_1.DefaultValuePipe; } });
Object.defineProperty(exports, "createExceptionFilter", { enumerable: true, get: function () { return AOP_1.createExceptionFilter; } });
Object.defineProperty(exports, "applyExceptionFilters", { enumerable: true, get: function () { return AOP_1.applyExceptionFilters; } });
Object.defineProperty(exports, "UseGuards", { enumerable: true, get: function () { return AOP_1.UseGuards; } });
Object.defineProperty(exports, "UseInterceptors", { enumerable: true, get: function () { return AOP_1.UseInterceptors; } });
Object.defineProperty(exports, "UsePipes", { enumerable: true, get: function () { return AOP_1.UsePipes; } });
Object.defineProperty(exports, "getGuardMetadata", { enumerable: true, get: function () { return AOP_1.getGuardMetadata; } });
Object.defineProperty(exports, "getInterceptorMetadata", { enumerable: true, get: function () { return AOP_1.getInterceptorMetadata; } });
// NOTE: Microservices, CQRS, and GraphQL have been moved to their own entry points (e.g. 'canxjs/microservices').
var Migration_1 = require("./database/Migration");
Object.defineProperty(exports, "Schema", { enumerable: true, get: function () { return Migration_1.Schema; } });
Object.defineProperty(exports, "migrator", { enumerable: true, get: function () { return Migration_1.migrator; } });
Object.defineProperty(exports, "defineMigration", { enumerable: true, get: function () { return Migration_1.defineMigration; } });
var Seeder_1 = require("./database/Seeder");
Object.defineProperty(exports, "seeder", { enumerable: true, get: function () { return Seeder_1.seeder; } });
Object.defineProperty(exports, "fake", { enumerable: true, get: function () { return Seeder_1.fake; } });
Object.defineProperty(exports, "seederFactory", { enumerable: true, get: function () { return Seeder_1.factory; } });
Object.defineProperty(exports, "defineSeeder", { enumerable: true, get: function () { return Seeder_1.defineSeeder; } });
// ============================================
// Queue Exports
// ============================================
var Queue_1 = require("./queue/Queue");
Object.defineProperty(exports, "queue", { enumerable: true, get: function () { return Queue_1.queue; } });
Object.defineProperty(exports, "createQueue", { enumerable: true, get: function () { return Queue_1.createQueue; } });
var RedisDriver_1 = require("./queue/drivers/RedisDriver");
Object.defineProperty(exports, "RedisDriver", { enumerable: true, get: function () { return RedisDriver_1.RedisDriver; } });
var MemoryDriver_1 = require("./queue/drivers/MemoryDriver");
Object.defineProperty(exports, "MemoryDriver", { enumerable: true, get: function () { return MemoryDriver_1.MemoryDriver; } });
var QueueController_1 = require("./queue/ui/QueueController");
Object.defineProperty(exports, "QueueController", { enumerable: true, get: function () { return QueueController_1.QueueController; } });
// ============================================
// Realtime Exports
// ============================================
var Channel_1 = require("./realtime/Channel");
Object.defineProperty(exports, "channel", { enumerable: true, get: function () { return Channel_1.channel; } });
Object.defineProperty(exports, "createChannel", { enumerable: true, get: function () { return Channel_1.createChannel; } });
var WebSocket_1 = require("./realtime/WebSocket");
Object.defineProperty(exports, "ws", { enumerable: true, get: function () { return WebSocket_1.ws; } });
Object.defineProperty(exports, "createWebSocketServer", { enumerable: true, get: function () { return WebSocket_1.createWebSocketServer; } });
Object.defineProperty(exports, "WebSocketServer", { enumerable: true, get: function () { return WebSocket_1.WebSocketServer; } });
// ============================================
// Storage Exports
// ============================================
var Storage_1 = require("./storage/Storage");
Object.defineProperty(exports, "storage", { enumerable: true, get: function () { return Storage_1.storage; } });
Object.defineProperty(exports, "initStorage", { enumerable: true, get: function () { return Storage_1.initStorage; } });
Object.defineProperty(exports, "handleUpload", { enumerable: true, get: function () { return Storage_1.handleUpload; } });
Object.defineProperty(exports, "handleMultipleUploads", { enumerable: true, get: function () { return Storage_1.handleMultipleUploads; } });
var LocalDriver_1 = require("./storage/drivers/LocalDriver");
Object.defineProperty(exports, "LocalDriver", { enumerable: true, get: function () { return LocalDriver_1.LocalDriver; } });
var S3Driver_1 = require("./storage/drivers/S3Driver");
Object.defineProperty(exports, "S3Driver", { enumerable: true, get: function () { return S3Driver_1.S3Driver; } });
// ============================================
// Events Exports
// ============================================
var EventEmitter_1 = require("./events/EventEmitter");
Object.defineProperty(exports, "events", { enumerable: true, get: function () { return EventEmitter_1.events; } });
Object.defineProperty(exports, "createEventEmitter", { enumerable: true, get: function () { return EventEmitter_1.createEventEmitter; } });
Object.defineProperty(exports, "EventEmitter", { enumerable: true, get: function () { return EventEmitter_1.EventEmitter; } });
Object.defineProperty(exports, "Listen", { enumerable: true, get: function () { return EventEmitter_1.Listen; } });
Object.defineProperty(exports, "getEventListeners", { enumerable: true, get: function () { return EventEmitter_1.getEventListeners; } });
Object.defineProperty(exports, "EventServiceProvider", { enumerable: true, get: function () { return EventEmitter_1.EventServiceProvider; } });
// ============================================
// Notifications Exports
// ============================================
var Mail_1 = require("./notifications/Mail");
Object.defineProperty(exports, "initMail", { enumerable: true, get: function () { return Mail_1.initMail; } });
Object.defineProperty(exports, "mail", { enumerable: true, get: function () { return Mail_1.mail; } });
Object.defineProperty(exports, "sendMail", { enumerable: true, get: function () { return Mail_1.sendMail; } });
Object.defineProperty(exports, "Mailer", { enumerable: true, get: function () { return Mail_1.Mailer; } });
Object.defineProperty(exports, "MailBuilder", { enumerable: true, get: function () { return Mail_1.MailBuilder; } });
var Notification_1 = require("./notifications/Notification");
Object.defineProperty(exports, "notifications", { enumerable: true, get: function () { return Notification_1.notifications; } });
Object.defineProperty(exports, "notify", { enumerable: true, get: function () { return Notification_1.notify; } });
Object.defineProperty(exports, "notifyMany", { enumerable: true, get: function () { return Notification_1.notifyMany; } });
Object.defineProperty(exports, "Notification", { enumerable: true, get: function () { return Notification_1.Notification; } });
Object.defineProperty(exports, "makeNotifiable", { enumerable: true, get: function () { return Notification_1.makeNotifiable; } });
// ============================================
// Container / DI Exports
// ============================================
var Container_1 = require("./container/Container");
Object.defineProperty(exports, "container", { enumerable: true, get: function () { return Container_1.container; } });
Object.defineProperty(exports, "bind", { enumerable: true, get: function () { return Container_1.bind; } });
Object.defineProperty(exports, "singleton", { enumerable: true, get: function () { return Container_1.singleton; } });
Object.defineProperty(exports, "resolve", { enumerable: true, get: function () { return Container_1.resolve; } });
Object.defineProperty(exports, "Injectable", { enumerable: true, get: function () { return Container_1.Injectable; } });
Object.defineProperty(exports, "Inject", { enumerable: true, get: function () { return Container_1.Inject; } });
Object.defineProperty(exports, "Container", { enumerable: true, get: function () { return Container_1.Container; } });
Object.defineProperty(exports, "ScopedContainer", { enumerable: true, get: function () { return Container_1.ScopedContainer; } });
Object.defineProperty(exports, "containerMiddleware", { enumerable: true, get: function () { return Container_1.containerMiddleware; } });
Object.defineProperty(exports, "forwardRef", { enumerable: true, get: function () { return Container_1.forwardRef; } });
Object.defineProperty(exports, "isForwardRef", { enumerable: true, get: function () { return Container_1.isForwardRef; } });
Object.defineProperty(exports, "Scope", { enumerable: true, get: function () { return Container_1.Scope; } });
Object.defineProperty(exports, "AutoWire", { enumerable: true, get: function () { return Container_1.AutoWire; } });
var Scope_1 = require("./container/Scope");
Object.defineProperty(exports, "requestScopeMiddleware", { enumerable: true, get: function () { return Scope_1.requestScopeMiddleware; } });
Object.defineProperty(exports, "runInRequestContext", { enumerable: true, get: function () { return Scope_1.runInRequestContext; } });
Object.defineProperty(exports, "runWithRequestId", { enumerable: true, get: function () { return Scope_1.runWithRequestId; } });
Object.defineProperty(exports, "setRequestContext", { enumerable: true, get: function () { return Scope_1.setRequestContext; } });
Object.defineProperty(exports, "getRequestId", { enumerable: true, get: function () { return Scope_1.getRequestId; } });
Object.defineProperty(exports, "clearRequestContext", { enumerable: true, get: function () { return Scope_1.clearRequestContext; } });
// NOTE: GraphQL module has been moved to 'canxjs/graphql'.
// ============================================
// HTTP/2 Exports
// ============================================
var Http2Server_1 = require("./core/Http2Server");
Object.defineProperty(exports, "Http2Server", { enumerable: true, get: function () { return Http2Server_1.Http2Server; } });
Object.defineProperty(exports, "createHttp2Server", { enumerable: true, get: function () { return Http2Server_1.createHttp2Server; } });
Object.defineProperty(exports, "startHttp2", { enumerable: true, get: function () { return Http2Server_1.startHttp2; } });
Object.defineProperty(exports, "createHttp2Middleware", { enumerable: true, get: function () { return Http2Server_1.createHttp2Middleware; } });
// ============================================
// Health Check Exports
// ============================================
var HealthModule_1 = require("./health/HealthModule");
Object.defineProperty(exports, "HealthModule", { enumerable: true, get: function () { return HealthModule_1.HealthModule; } });
Object.defineProperty(exports, "HealthCheckService", { enumerable: true, get: function () { return HealthModule_1.HealthCheckService; } });
Object.defineProperty(exports, "HealthIndicator", { enumerable: true, get: function () { return HealthModule_1.HealthIndicator; } });
Object.defineProperty(exports, "DatabaseHealthIndicator", { enumerable: true, get: function () { return HealthModule_1.DatabaseHealthIndicator; } });
Object.defineProperty(exports, "MemoryHealthIndicator", { enumerable: true, get: function () { return HealthModule_1.MemoryHealthIndicator; } });
Object.defineProperty(exports, "DiskHealthIndicator", { enumerable: true, get: function () { return HealthModule_1.DiskHealthIndicator; } });
Object.defineProperty(exports, "HealthCheckError", { enumerable: true, get: function () { return HealthModule_1.HealthCheckError; } });
// ============================================
// Utils Exports
// ============================================
var RateLimiter_1 = require("./middlewares/RateLimiter");
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return RateLimiter_1.RateLimiter; } });
Object.defineProperty(exports, "createRateLimiter", { enumerable: true, get: function () { return RateLimiter_1.rateLimit; } });
Object.defineProperty(exports, "createMemoryStore", { enumerable: true, get: function () { return RateLimiter_1.createMemoryStore; } });
Object.defineProperty(exports, "createCacheStore", { enumerable: true, get: function () { return RateLimiter_1.createCacheStore; } });
Object.defineProperty(exports, "createRedisStore", { enumerable: true, get: function () { return RateLimiter_1.createRedisStore; } });
Object.defineProperty(exports, "RedisStore", { enumerable: true, get: function () { return RateLimiter_1.RedisStore; } });
Object.defineProperty(exports, "MemoryStore", { enumerable: true, get: function () { return RateLimiter_1.MemoryStore; } });
var QueryParser_1 = require("./utils/QueryParser");
Object.defineProperty(exports, "QueryParser", { enumerable: true, get: function () { return QueryParser_1.QueryParser; } });
Object.defineProperty(exports, "parseQuery", { enumerable: true, get: function () { return QueryParser_1.parseQuery; } });
Object.defineProperty(exports, "QueryParams", { enumerable: true, get: function () { return QueryParser_1.QueryParams; } });
var Validator_1 = require("./utils/Validator");
Object.defineProperty(exports, "validate", { enumerable: true, get: function () { return Validator_1.validate; } });
Object.defineProperty(exports, "validateAsync", { enumerable: true, get: function () { return Validator_1.validateAsync; } });
Object.defineProperty(exports, "is", { enumerable: true, get: function () { return Validator_1.is; } });
Object.defineProperty(exports, "extend", { enumerable: true, get: function () { return Validator_1.extend; } });
Object.defineProperty(exports, "extendAsync", { enumerable: true, get: function () { return Validator_1.extendAsync; } });
Object.defineProperty(exports, "extendParam", { enumerable: true, get: function () { return Validator_1.extendParam; } });
Object.defineProperty(exports, "setMessage", { enumerable: true, get: function () { return Validator_1.setMessage; } });
// ============================================
// Testing Exports
// ============================================
var TestHelper_1 = require("./testing/TestHelper");
Object.defineProperty(exports, "HttpTest", { enumerable: true, get: function () { return TestHelper_1.HttpTest; } });
Object.defineProperty(exports, "DatabaseTest", { enumerable: true, get: function () { return TestHelper_1.DatabaseTest; } });
Object.defineProperty(exports, "createHttpTest", { enumerable: true, get: function () { return TestHelper_1.createHttpTest; } });
Object.defineProperty(exports, "TestCase", { enumerable: true, get: function () { return TestHelper_1.TestCase; } });
// Utils - Request/Response
var Response_1 = require("./utils/Response");
Object.defineProperty(exports, "ResponseBuilder", { enumerable: true, get: function () { return Response_1.ResponseBuilder; } });
Object.defineProperty(exports, "response", { enumerable: true, get: function () { return Response_1.response; } });
var Request_1 = require("./utils/Request");
Object.defineProperty(exports, "RequestParser", { enumerable: true, get: function () { return Request_1.RequestParser; } });
Object.defineProperty(exports, "parseRequest", { enumerable: true, get: function () { return Request_1.parseRequest; } });
// Environment Helper
var Env_1 = require("./utils/Env");
Object.defineProperty(exports, "env", { enumerable: true, get: function () { return Env_1.env; } });
Object.defineProperty(exports, "isProduction", { enumerable: true, get: function () { return Env_1.isProduction; } });
Object.defineProperty(exports, "isDevelopment", { enumerable: true, get: function () { return Env_1.isDevelopment; } });
Object.defineProperty(exports, "isTest", { enumerable: true, get: function () { return Env_1.isTest; } });
Object.defineProperty(exports, "requireEnv", { enumerable: true, get: function () { return Env_1.requireEnv; } });
// Error Handling
var CanxException_1 = require("./core/exceptions/CanxException");
Object.defineProperty(exports, "CanxException", { enumerable: true, get: function () { return CanxException_1.CanxException; } });
var HttpException_1 = require("./core/exceptions/HttpException");
Object.defineProperty(exports, "HttpException", { enumerable: true, get: function () { return HttpException_1.HttpException; } });
var NotFoundException_1 = require("./core/exceptions/NotFoundException");
Object.defineProperty(exports, "NotFoundException", { enumerable: true, get: function () { return NotFoundException_1.NotFoundException; } });
var ValidationException_1 = require("./core/exceptions/ValidationException");
Object.defineProperty(exports, "ValidationException", { enumerable: true, get: function () { return ValidationException_1.ValidationException; } });
var ViewNotFoundException_1 = require("./core/exceptions/ViewNotFoundException");
Object.defineProperty(exports, "ViewNotFoundException", { enumerable: true, get: function () { return ViewNotFoundException_1.ViewNotFoundException; } });
var UnauthorizedException_1 = require("./core/exceptions/UnauthorizedException");
Object.defineProperty(exports, "UnauthorizedException", { enumerable: true, get: function () { return UnauthorizedException_1.UnauthorizedException; } });
var ForbiddenException_1 = require("./core/exceptions/ForbiddenException");
Object.defineProperty(exports, "ForbiddenException", { enumerable: true, get: function () { return ForbiddenException_1.ForbiddenException; } });
var MethodNotAllowedException_1 = require("./core/exceptions/MethodNotAllowedException");
Object.defineProperty(exports, "MethodNotAllowedException", { enumerable: true, get: function () { return MethodNotAllowedException_1.MethodNotAllowedException; } });
var BadRequestException_1 = require("./core/exceptions/BadRequestException");
Object.defineProperty(exports, "BadRequestException", { enumerable: true, get: function () { return BadRequestException_1.BadRequestException; } });
var ConflictException_1 = require("./core/exceptions/ConflictException");
Object.defineProperty(exports, "ConflictException", { enumerable: true, get: function () { return ConflictException_1.ConflictException; } });
var TooManyRequestsException_1 = require("./core/exceptions/TooManyRequestsException");
Object.defineProperty(exports, "TooManyRequestsException", { enumerable: true, get: function () { return TooManyRequestsException_1.TooManyRequestsException; } });
var ServiceUnavailableException_1 = require("./core/exceptions/ServiceUnavailableException");
Object.defineProperty(exports, "ServiceUnavailableException", { enumerable: true, get: function () { return ServiceUnavailableException_1.ServiceUnavailableException; } });
var InternalServerException_1 = require("./core/exceptions/InternalServerException");
Object.defineProperty(exports, "InternalServerException", { enumerable: true, get: function () { return InternalServerException_1.InternalServerException; } });
var ErrorHandler_2 = require("./utils/ErrorHandler");
Object.defineProperty(exports, "CanxError", { enumerable: true, get: function () { return ErrorHandler_2.CanxError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return ErrorHandler_2.ValidationError; } });
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return ErrorHandler_2.NotFoundError; } });
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return ErrorHandler_2.AuthenticationError; } });
Object.defineProperty(exports, "AuthorizationError", { enumerable: true, get: function () { return ErrorHandler_2.AuthorizationError; } });
Object.defineProperty(exports, "ConflictError", { enumerable: true, get: function () { return ErrorHandler_2.ConflictError; } });
Object.defineProperty(exports, "RateLimitError", { enumerable: true, get: function () { return ErrorHandler_2.RateLimitError; } });
Object.defineProperty(exports, "BadRequestError", { enumerable: true, get: function () { return ErrorHandler_2.BadRequestError; } });
Object.defineProperty(exports, "DatabaseError", { enumerable: true, get: function () { return ErrorHandler_2.DatabaseError; } });
Object.defineProperty(exports, "ServiceUnavailableError", { enumerable: true, get: function () { return ErrorHandler_2.ServiceUnavailableError; } });
Object.defineProperty(exports, "errorHandler", { enumerable: true, get: function () { return ErrorHandler_2.errorHandler; } });
Object.defineProperty(exports, "asyncHandler", { enumerable: true, get: function () { return ErrorHandler_2.asyncHandler; } });
Object.defineProperty(exports, "assertFound", { enumerable: true, get: function () { return ErrorHandler_2.assertFound; } });
Object.defineProperty(exports, "assertAuthenticated", { enumerable: true, get: function () { return ErrorHandler_2.assertAuthenticated; } });
Object.defineProperty(exports, "assertAuthorized", { enumerable: true, get: function () { return ErrorHandler_2.assertAuthorized; } });
Object.defineProperty(exports, "assertValid", { enumerable: true, get: function () { return ErrorHandler_2.assertValid; } });
Object.defineProperty(exports, "errors", { enumerable: true, get: function () { return ErrorHandler_2.errors; } });
// Logging
var Logger_1 = require("./utils/Logger");
Object.defineProperty(exports, "log", { enumerable: true, get: function () { return Logger_1.log; } });
Object.defineProperty(exports, "createLogger", { enumerable: true, get: function () { return Logger_1.createLogger; } });
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return Logger_1.Logger; } });
Object.defineProperty(exports, "requestLogger", { enumerable: true, get: function () { return Logger_1.requestLogger; } });
Object.defineProperty(exports, "createFileTransport", { enumerable: true, get: function () { return Logger_1.createFileTransport; } });
// Health Checks & Metrics
var Health_1 = require("./utils/Health");
Object.defineProperty(exports, "health", { enumerable: true, get: function () { return Health_1.health; } });
Object.defineProperty(exports, "metrics", { enumerable: true, get: function () { return Health_1.metrics; } });
Object.defineProperty(exports, "databaseCheck", { enumerable: true, get: function () { return Health_1.databaseCheck; } });
Object.defineProperty(exports, "memoryCheck", { enumerable: true, get: function () { return Health_1.memoryCheck; } });
Object.defineProperty(exports, "diskCheck", { enumerable: true, get: function () { return Health_1.diskCheck; } });
Object.defineProperty(exports, "httpCheck", { enumerable: true, get: function () { return Health_1.httpCheck; } });
Object.defineProperty(exports, "redisCheck", { enumerable: true, get: function () { return Health_1.redisCheck; } });
Object.defineProperty(exports, "customCheck", { enumerable: true, get: function () { return Health_1.customCheck; } });
Object.defineProperty(exports, "healthRoutes", { enumerable: true, get: function () { return Health_1.healthRoutes; } });
Object.defineProperty(exports, "createHealthManager", { enumerable: true, get: function () { return Health_1.createHealthManager; } });
// Internationalization
var i18n_1 = require("./utils/i18n");
Object.defineProperty(exports, "initI18n", { enumerable: true, get: function () { return i18n_1.initI18n; } });
Object.defineProperty(exports, "useI18n", { enumerable: true, get: function () { return i18n_1.useI18n; } });
Object.defineProperty(exports, "t", { enumerable: true, get: function () { return i18n_1.t; } });
Object.defineProperty(exports, "plural", { enumerable: true, get: function () { return i18n_1.plural; } });
Object.defineProperty(exports, "I18n", { enumerable: true, get: function () { return i18n_1.I18n; } });
Object.defineProperty(exports, "i18nMiddleware", { enumerable: true, get: function () { return i18n_1.i18nMiddleware; } });
// ============================================
// Security Exports
// ============================================
// Hashing (bcrypt, argon2, scrypt)
var Hash_1 = require("./utils/Hash");
Object.defineProperty(exports, "hash", { enumerable: true, get: function () { return Hash_1.hash; } });
Object.defineProperty(exports, "hashMake", { enumerable: true, get: function () { return Hash_1.hashPassword; } });
Object.defineProperty(exports, "hashCheck", { enumerable: true, get: function () { return Hash_1.verifyPassword; } });
Object.defineProperty(exports, "needsRehash", { enumerable: true, get: function () { return Hash_1.needsRehash; } });
Object.defineProperty(exports, "Hash", { enumerable: true, get: function () { return Hash_1.Hash; } });
// Encryption (AES-256-GCM)
var Encrypt_1 = require("./utils/Encrypt");
Object.defineProperty(exports, "encryptor", { enumerable: true, get: function () { return Encrypt_1.encryptor; } });
Object.defineProperty(exports, "initEncrypt", { enumerable: true, get: function () { return Encrypt_1.initEncrypt; } });
Object.defineProperty(exports, "encrypt", { enumerable: true, get: function () { return Encrypt_1.encrypt; } });
Object.defineProperty(exports, "decrypt", { enumerable: true, get: function () { return Encrypt_1.decrypt; } });
Object.defineProperty(exports, "generateKey", { enumerable: true, get: function () { return Encrypt_1.generateKey; } });
Object.defineProperty(exports, "deriveKey", { enumerable: true, get: function () { return Encrypt_1.deriveKey; } });
Object.defineProperty(exports, "Encrypt", { enumerable: true, get: function () { return Encrypt_1.Encrypt; } });
// ============================================
// Pagination Exports
// ============================================
var Paginator_1 = require("./utils/Paginator");
Object.defineProperty(exports, "Paginator", { enumerable: true, get: function () { return Paginator_1.Paginator; } });
Object.defineProperty(exports, "SimplePaginator", { enumerable: true, get: function () { return Paginator_1.SimplePaginator; } });
Object.defineProperty(exports, "CursorPaginator", { enumerable: true, get: function () { return Paginator_1.CursorPaginator; } });
Object.defineProperty(exports, "paginate", { enumerable: true, get: function () { return Paginator_1.paginate; } });
Object.defineProperty(exports, "simplePaginate", { enumerable: true, get: function () { return Paginator_1.simplePaginate; } });
Object.defineProperty(exports, "cursorPaginate", { enumerable: true, get: function () { return Paginator_1.cursorPaginate; } });
// ============================================
// Form Request Exports
// ============================================
var FormRequest_1 = require("./utils/FormRequest");
Object.defineProperty(exports, "FormRequest", { enumerable: true, get: function () { return FormRequest_1.FormRequest; } });
Object.defineProperty(exports, "formRequest", { enumerable: true, get: function () { return FormRequest_1.formRequest; } });
Object.defineProperty(exports, "validated", { enumerable: true, get: function () { return FormRequest_1.validated; } });
Object.defineProperty(exports, "getFormRequest", { enumerable: true, get: function () { return FormRequest_1.getFormRequest; } });
Object.defineProperty(exports, "createFormRequest", { enumerable: true, get: function () { return FormRequest_1.createFormRequest; } });
Object.defineProperty(exports, "ValidateWith", { enumerable: true, get: function () { return FormRequest_1.ValidateWith; } });
// ============================================
// API Resource Exports
// ============================================
var Resource_1 = require("./utils/Resource");
Object.defineProperty(exports, "JsonResource", { enumerable: true, get: function () { return Resource_1.JsonResource; } });
Object.defineProperty(exports, "Resource", { enumerable: true, get: function () { return Resource_1.Resource; } });
Object.defineProperty(exports, "ResourceCollection", { enumerable: true, get: function () { return Resource_1.ResourceCollection; } });
Object.defineProperty(exports, "AnonymousResource", { enumerable: true, get: function () { return Resource_1.AnonymousResource; } });
Object.defineProperty(exports, "resource", { enumerable: true, get: function () { return Resource_1.resource; } });
Object.defineProperty(exports, "resourceCollection", { enumerable: true, get: function () { return Resource_1.collection; } });
Object.defineProperty(exports, "wrap", { enumerable: true, get: function () { return Resource_1.wrap; } });
Object.defineProperty(exports, "success", { enumerable: true, get: function () { return Resource_1.success; } });
Object.defineProperty(exports, "error", { enumerable: true, get: function () { return Resource_1.error; } });
Object.defineProperty(exports, "when", { enumerable: true, get: function () { return Resource_1.when; } });
Object.defineProperty(exports, "whenNotNull", { enumerable: true, get: function () { return Resource_1.whenNotNull; } });
Object.defineProperty(exports, "whenLoaded", { enumerable: true, get: function () { return Resource_1.whenLoaded; } });
Object.defineProperty(exports, "mergeWhen", { enumerable: true, get: function () { return Resource_1.mergeWhen; } });
// ============================================
// Collection Exports
// ============================================
var Collection_1 = require("./utils/Collection");
Object.defineProperty(exports, "Collection", { enumerable: true, get: function () { return Collection_1.Collection; } });
Object.defineProperty(exports, "collect", { enumerable: true, get: function () { return Collection_1.collect; } });
Object.defineProperty(exports, "range", { enumerable: true, get: function () { return Collection_1.range; } });
Object.defineProperty(exports, "times", { enumerable: true, get: function () { return Collection_1.times; } });
// ============================================
// Testing Exports
// ============================================
var TestCase_1 = require("./testing/TestCase");
Object.defineProperty(exports, "ResponseAssertions", { enumerable: true, get: function () { return TestCase_1.ResponseAssertions; } });
Object.defineProperty(exports, "MockFactory", { enumerable: true, get: function () { return TestCase_1.MockFactory; } });
Object.defineProperty(exports, "createTestClient", { enumerable: true, get: function () { return TestCase_1.createTestClient; } });
Object.defineProperty(exports, "assertResponse", { enumerable: true, get: function () { return TestCase_1.assertResponse; } });
Object.defineProperty(exports, "factory", { enumerable: true, get: function () { return TestCase_1.factory; } });
Object.defineProperty(exports, "randomString", { enumerable: true, get: function () { return TestCase_1.randomString; } });
Object.defineProperty(exports, "randomEmail", { enumerable: true, get: function () { return TestCase_1.randomEmail; } });
Object.defineProperty(exports, "randomNumber", { enumerable: true, get: function () { return TestCase_1.randomNumber; } });
Object.defineProperty(exports, "randomUuid", { enumerable: true, get: function () { return TestCase_1.randomUuid; } });
Object.defineProperty(exports, "sleep", { enumerable: true, get: function () { return TestCase_1.sleep; } });
// ============================================
// Default Export
// ============================================
var Application_2 = require("./Application");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return Application_2.Canx; } });
// ... (previous exports)
// ============================================
// Realtime / WebSockets (Advanced)
// ============================================
var Decorators_2 = require("./realtime/Decorators");
Object.defineProperty(exports, "WebSocketGateway", { enumerable: true, get: function () { return Decorators_2.WebSocketGateway; } });
Object.defineProperty(exports, "SubscribeMessage", { enumerable: true, get: function () { return Decorators_2.SubscribeMessage; } });
Object.defineProperty(exports, "MessageBody", { enumerable: true, get: function () { return Decorators_2.MessageBody; } });
Object.defineProperty(exports, "ConnectedSocket", { enumerable: true, get: function () { return Decorators_2.ConnectedSocket; } });
Object.defineProperty(exports, "GATEWAY_METADATA", { enumerable: true, get: function () { return Decorators_2.GATEWAY_METADATA; } });
var GatewayManager_1 = require("./realtime/GatewayManager");
Object.defineProperty(exports, "GatewayManager", { enumerable: true, get: function () { return GatewayManager_1.GatewayManager; } });
// ============================================
// Advanced Testing
// ============================================
var Test_1 = require("./testing/Test");
Object.defineProperty(exports, "Test", { enumerable: true, get: function () { return Test_1.Test; } });
Object.defineProperty(exports, "TestingModuleBuilder", { enumerable: true, get: function () { return Test_1.TestingModuleBuilder; } });
// ============================================
// Observability / Tracing
// ============================================
var Tracing_1 = require("./core/Tracing");
Object.defineProperty(exports, "TracingModule", { enumerable: true, get: function () { return Tracing_1.TracingModule; } });
Object.defineProperty(exports, "Trace", { enumerable: true, get: function () { return Tracing_1.Trace; } });
// ============================================
// Developer Tools
// ============================================
var DevToolsModule_1 = require("./devtools/DevToolsModule");
Object.defineProperty(exports, "DevToolsModule", { enumerable: true, get: function () { return DevToolsModule_1.DevToolsModule; } });
// ============================================
// AsyncAPI & Events
// ============================================
var AsyncApi_1 = require("./features/AsyncApi");
Object.defineProperty(exports, "AsyncApiGenerator", { enumerable: true, get: function () { return AsyncApi_1.AsyncApiGenerator; } });
Object.defineProperty(exports, "AsyncApiChannel", { enumerable: true, get: function () { return AsyncApi_1.AsyncApiChannel; } });
Object.defineProperty(exports, "AsyncApiMessage", { enumerable: true, get: function () { return AsyncApi_1.AsyncApiMessage; } });
