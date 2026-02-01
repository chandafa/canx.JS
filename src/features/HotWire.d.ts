/**
 * CanxJS HotWire - Real-time streaming protocol without WebSocket setup
 * Unique feature: Server-sent events with partial HTML updates
 */
import type { HotWireConfig, CanxRequest, CanxResponse } from '../types';
declare class HotWireManager {
    private clients;
    private channels;
    private config;
    private pingInterval;
    constructor(config?: HotWireConfig);
    /**
     * Create SSE stream for client
     */
    createStream(req: CanxRequest, res: CanxResponse): Response;
    /**
     * Subscribe client to channel
     */
    subscribe(clientId: string, channel: string): void;
    /**
     * Unsubscribe client from channel
     */
    unsubscribe(clientId: string, channel: string): void;
    /**
     * Broadcast to all clients in channel
     */
    broadcast(channel: string, data: string | object): void;
    /**
     * Broadcast HTML update to channel
     */
    broadcastHTML(channel: string, html: string, target: string, action?: 'replace' | 'append' | 'prepend'): void;
    /**
     * Send to specific client
     */
    sendTo(clientId: string, data: string | object): void;
    /**
     * Broadcast to all connected clients
     */
    broadcastAll(data: string | object): void;
    private removeClient;
    private pingClients;
    getStats(): {
        clients: number;
        channels: number;
    };
    destroy(): void;
}
export declare const hotWire: HotWireManager;
export declare function createHotWire(config?: HotWireConfig): HotWireManager;
export default hotWire;
