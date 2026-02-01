import { ModuleContainer } from '../core/Module';
import { WebSocketServer } from './WebSocket';
export declare class GatewayManager {
    private readonly container;
    private readonly wsServer;
    constructor(container: ModuleContainer, wsServer?: WebSocketServer);
    /**
     * Scan for Gateways and bind events
     */
    registerGateways(): void;
    /**
     * Bind gateway methods to WebSocket events
     */
    private bindGateway;
    private resolveArgs;
}
