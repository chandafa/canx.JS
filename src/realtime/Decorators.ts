import 'reflect-metadata';

export const GATEWAY_METADATA = '__gateway__';
export const GATEWAY_OPTIONS = '__gateway_options__';
export const MESSAGE_MAPPING = '__message_mapping__';
export const PARAM_ARGS_METADATA = '__param_args_metadata__';

export enum WsParamType {
  SOCKET = 'SOCKET',
  PAYLOAD = 'PAYLOAD',
  EVENT = 'EVENT',
}

export interface GatewayOptions {
  port?: number;
  path?: string;
  namespace?: string;
  transports?: string[];
}

/**
 * Marks a class as a WebSocket Gateway
 */
export function WebSocketGateway(options?: GatewayOptions | number): ClassDecorator {
  return (target: object) => {
    const opts = typeof options === 'number' ? { port: options } : options || {};
    Reflect.defineMetadata(GATEWAY_METADATA, true, target);
    Reflect.defineMetadata(GATEWAY_OPTIONS, opts, target);
  };
}

/**
 * Subscribes to a specific message event
 */
export function SubscribeMessage(event: string): MethodDecorator {
  return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(MESSAGE_MAPPING, event, descriptor.value);
    return descriptor;
  };
}

/**
 * Injects the WebSocket client
 */
export function ConnectedSocket(): ParameterDecorator {
  return (target: object, key: string | symbol | undefined, index: number) => {
    const args = Reflect.getMetadata(PARAM_ARGS_METADATA, target, key!) || {};
    Reflect.defineMetadata(PARAM_ARGS_METADATA, { ...args, [index]: WsParamType.SOCKET }, target, key!);
  };
}

/**
 * Injects the message payload
 */
export function MessageBody(): ParameterDecorator {
  return (target: object, key: string | symbol | undefined, index: number) => {
    const args = Reflect.getMetadata(PARAM_ARGS_METADATA, target, key!) || {};
    Reflect.defineMetadata(PARAM_ARGS_METADATA, { ...args, [index]: WsParamType.PAYLOAD }, target, key!);
  };
}
