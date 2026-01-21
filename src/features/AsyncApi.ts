/**
 * CanxJS AsyncAPI - Event-Driven Architecture Documentation
 * Support for AsyncAPI 2.6 specification generation
 */

import 'reflect-metadata';

// ============================================
// Types
// ============================================

export interface AsyncApiInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface AsyncApiServer {
  url: string;
  protocol: string;
  description?: string;
  security?: Record<string, any>[];
}

export interface AsyncApiOptions {
  info: AsyncApiInfo;
  servers?: Record<string, AsyncApiServer>;
  defaultContentType?: string;
}

// ============================================
// Decorators
// ============================================

const ASYNCAPI_CHANNEL_METADATA = 'asyncapi:channel';
const ASYNCAPI_MESSAGE_METADATA = 'asyncapi:message';

export interface ChannelOptions {
  name: string;
  description?: string;
  publish?: boolean;
  subscribe?: boolean;
}

export interface MessageOptions {
  name?: string;
  payload: any; // Class constructor
  summary?: string;
}

export function AsyncApiChannel(options: ChannelOptions): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    if (descriptor.value) {
      Reflect.defineMetadata(ASYNCAPI_CHANNEL_METADATA, options, descriptor.value);
    }
    return descriptor;
  };
}

export function AsyncApiMessage(options: MessageOptions): MethodDecorator {
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

export class AsyncApiGenerator {
  static createDocument(app: any, options: AsyncApiOptions): any {
    const document: any = {
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
