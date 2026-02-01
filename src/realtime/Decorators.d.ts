import 'reflect-metadata';
export declare const GATEWAY_METADATA = "__gateway__";
export declare const GATEWAY_OPTIONS = "__gateway_options__";
export declare const MESSAGE_MAPPING = "__message_mapping__";
export declare const PARAM_ARGS_METADATA = "__param_args_metadata__";
export declare enum WsParamType {
    SOCKET = "SOCKET",
    PAYLOAD = "PAYLOAD",
    EVENT = "EVENT"
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
export declare function WebSocketGateway(options?: GatewayOptions | number): ClassDecorator;
/**
 * Subscribes to a specific message event
 */
export declare function SubscribeMessage(event: string): MethodDecorator;
/**
 * Injects the WebSocket client
 */
export declare function ConnectedSocket(): ParameterDecorator;
/**
 * Injects the message payload
 */
export declare function MessageBody(): ParameterDecorator;
