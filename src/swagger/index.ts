/**
 * CanxJS Swagger Module
 * NestJS-compatible OpenAPI/Swagger documentation
 */

// Re-export everything from decorators
export {
  // Class decorators
  ApiTags,
  ApiBearerAuth,
  ApiKeyAuth,
  ApiBasicAuth,
  ApiOAuth2,
  ApiExcludeController,
  
  // Method decorators
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiAcceptedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiUnprocessableEntityResponse,
  ApiInternalServerErrorResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBody,
  ApiExcludeEndpoint,
  ApiProduces,
  ApiConsumes,
  
  // Property decorators
  ApiProperty,
  ApiPropertyOptional,
  ApiHideProperty,
  
  // Utilities
  buildSchemaFromType,
  getApiMetadata,
  getAllApiMetadata,
  getSchemaDefinitions,
  getPropertyMetadata,
} from './decorators';

// Export types
export type {
  ApiMetadata,
  ControllerApiMeta,
  MethodApiMeta,
  ParameterMeta,
  RequestBodyMeta,
  ResponseMeta,
  MediaTypeMeta,
  HeaderMeta,
  ExampleMeta,
  SchemaObject,
  SecurityRequirement,
  SchemaDefinition,
  ApiOperationOptions,
  ApiResponseOptions,
  ApiParamOptions,
  ApiQueryOptions,
  ApiHeaderOptions,
  ApiBodyOptions,
  ApiPropertyOptions,
  PropertyMeta,
} from './decorators';

// Re-export from SwaggerModule
export {
  SwaggerModule,
  SwaggerDocumentBuilder,
  createSwaggerDocument,
  setupSwagger,
} from './SwaggerModule';

// Export types from SwaggerModule
export type {
  SwaggerConfig,
  SwaggerUIConfig,
  SecurityScheme,
  OAuthFlows,
  OAuthFlow,
  OpenAPIDocument,
  PathItem,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
} from './SwaggerModule';
