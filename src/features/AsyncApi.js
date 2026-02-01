"use strict";
/**
 * CanxJS AsyncAPI - Event-Driven Architecture Documentation
 * Support for AsyncAPI 2.6 specification generation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncApiGenerator = void 0;
exports.AsyncApiChannel = AsyncApiChannel;
exports.AsyncApiMessage = AsyncApiMessage;
require("reflect-metadata");
// ============================================
// Decorators
// ============================================
const ASYNCAPI_CHANNEL_METADATA = 'asyncapi:channel';
const ASYNCAPI_MESSAGE_METADATA = 'asyncapi:message';
function AsyncApiChannel(options) {
    return (target, propertyKey, descriptor) => {
        if (descriptor.value) {
            Reflect.defineMetadata(ASYNCAPI_CHANNEL_METADATA, options, descriptor.value);
        }
        return descriptor;
    };
}
function AsyncApiMessage(options) {
    return (target, propertyKey, descriptor) => {
        if (descriptor.value) {
            Reflect.defineMetadata(ASYNCAPI_MESSAGE_METADATA, options, descriptor.value);
        }
        return descriptor;
    };
}
// ============================================
// Generator
// ============================================
class AsyncApiGenerator {
    static createDocument(app, options) {
        const document = {
            asyncapi: '2.6.0',
            info: options.info,
            servers: options.servers || {},
            channels: {},
            components: {
                messages: {},
                schemas: {},
            },
        };
        // Scan for channels in controllers/gateways
        // This requires access to registered controllers/gateways from the app
        // We'll iterate through all modules and their providers/controllers
        // NOTE: In a real implementation, we would traverse app.moduleContainer
        // For now, we assume users will manually pass the classes they want to document
        // or we scan the global container if available.
        // Placeholder for scanning logic
        // const controllers = app.moduleContainer.getControllers();
        return document;
    }
}
exports.AsyncApiGenerator = AsyncApiGenerator;
