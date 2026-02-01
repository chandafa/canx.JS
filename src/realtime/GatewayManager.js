"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayManager = void 0;
const WebSocket_1 = require("./WebSocket");
const Decorators_1 = require("./Decorators");
class GatewayManager {
    container;
    wsServer;
    constructor(container, wsServer = WebSocket_1.ws) {
        this.container = container;
        this.wsServer = wsServer;
    }
    /**
     * Scan for Gateways and bind events
     */
    registerGateways() {
        const providers = this.container.getGlobalProviders();
        for (const [token, instance] of providers) {
            if (!instance || !instance.constructor)
                continue;
            const isGateway = Reflect.getMetadata(Decorators_1.GATEWAY_METADATA, instance.constructor);
            if (isGateway) {
                this.bindGateway(instance);
            }
        }
    }
    /**
     * Bind gateway methods to WebSocket events
     */
    bindGateway(instance) {
        const prototype = Object.getPrototypeOf(instance);
        const methodNames = Object.getOwnPropertyNames(prototype);
        for (const methodName of methodNames) {
            const method = prototype[methodName];
            const event = Reflect.getMetadata(Decorators_1.MESSAGE_MAPPING, method);
            if (event) {
                // Register handler with WebSocketServer
                this.wsServer.on(event, async (ws, rawMessage) => {
                    let payload = rawMessage;
                    try {
                        // Basic JSON parsing if it looks like JSON
                        if (typeof rawMessage === 'string' && (rawMessage.startsWith('{') || rawMessage.startsWith('['))) {
                            payload = JSON.parse(rawMessage);
                            // Unwrap if it follows { event, data } pattern, strictly for the data part
                            // Actually, the wsServer 'on' handler already creates a custom event listener
                            // If using 'wsServer.on', it expects us to handle the specific logic.
                            // However, wsServer implementation already parses JSON events if they adhere to { event, data }.
                            // But here we are bridging the Gap.
                        }
                    }
                    catch { }
                    // Resolve arguments
                    const args = this.resolveArgs(instance, methodName, ws, payload);
                    // Call method
                    const result = await method.apply(instance, args);
                    // If result is returned, send it back (optional request-response pattern)
                    if (result !== undefined) {
                        ws.send(JSON.stringify({ event, data: result }));
                    }
                });
                console.log(`[Gateway] Mapped {${event}} to ${instance.constructor.name}.${methodName}`);
            }
        }
    }
    resolveArgs(instance, methodName, ws, payload) {
        const paramsMetadata = Reflect.getMetadata(Decorators_1.PARAM_ARGS_METADATA, instance, methodName) || {};
        const args = [];
        // Determine max index
        const indices = Object.keys(paramsMetadata).map(Number);
        if (indices.length === 0)
            return [ws, payload]; // Default signature if no decorators
        const maxIndex = Math.max(...indices);
        for (let i = 0; i <= maxIndex; i++) {
            const paramType = paramsMetadata[i];
            switch (paramType) {
                case Decorators_1.WsParamType.SOCKET:
                    args[i] = ws;
                    break;
                case Decorators_1.WsParamType.PAYLOAD:
                    args[i] = payload;
                    break;
                default:
                    args[i] = undefined;
            }
        }
        return args;
    }
}
exports.GatewayManager = GatewayManager;
