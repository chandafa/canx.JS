"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsParamType = exports.PARAM_ARGS_METADATA = exports.MESSAGE_MAPPING = exports.GATEWAY_OPTIONS = exports.GATEWAY_METADATA = void 0;
exports.WebSocketGateway = WebSocketGateway;
exports.SubscribeMessage = SubscribeMessage;
exports.ConnectedSocket = ConnectedSocket;
exports.MessageBody = MessageBody;
require("reflect-metadata");
exports.GATEWAY_METADATA = '__gateway__';
exports.GATEWAY_OPTIONS = '__gateway_options__';
exports.MESSAGE_MAPPING = '__message_mapping__';
exports.PARAM_ARGS_METADATA = '__param_args_metadata__';
var WsParamType;
(function (WsParamType) {
    WsParamType["SOCKET"] = "SOCKET";
    WsParamType["PAYLOAD"] = "PAYLOAD";
    WsParamType["EVENT"] = "EVENT";
})(WsParamType || (exports.WsParamType = WsParamType = {}));
/**
 * Marks a class as a WebSocket Gateway
 */
function WebSocketGateway(options) {
    return (target) => {
        const opts = typeof options === 'number' ? { port: options } : options || {};
        Reflect.defineMetadata(exports.GATEWAY_METADATA, true, target);
        Reflect.defineMetadata(exports.GATEWAY_OPTIONS, opts, target);
    };
}
/**
 * Subscribes to a specific message event
 */
function SubscribeMessage(event) {
    return (target, key, descriptor) => {
        Reflect.defineMetadata(exports.MESSAGE_MAPPING, event, descriptor.value);
        return descriptor;
    };
}
/**
 * Injects the WebSocket client
 */
function ConnectedSocket() {
    return (target, key, index) => {
        const args = Reflect.getMetadata(exports.PARAM_ARGS_METADATA, target, key) || {};
        Reflect.defineMetadata(exports.PARAM_ARGS_METADATA, { ...args, [index]: WsParamType.SOCKET }, target, key);
    };
}
/**
 * Injects the message payload
 */
function MessageBody() {
    return (target, key, index) => {
        const args = Reflect.getMetadata(exports.PARAM_ARGS_METADATA, target, key) || {};
        Reflect.defineMetadata(exports.PARAM_ARGS_METADATA, { ...args, [index]: WsParamType.PAYLOAD }, target, key);
    };
}
