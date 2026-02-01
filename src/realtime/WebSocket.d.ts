/**
 * CanxJS WebSocket - Full WebSocket support with rooms and channels
 */
import type { ServerWebSocket } from 'bun';
export interface WebSocketData {
    id: string;
    userId?: string | number;
    rooms: Set<string>;
    metadata: Record<string, unknown>;
}
export type WebSocketHandler = (ws: ServerWebSocket<WebSocketData>, message: string | Buffer) => void | Promise<void>;
export type WebSocketEventHandler = (ws: ServerWebSocket<WebSocketData>) => void;
export interface WebSocketConfig {
    path?: string;
    maxPayloadLength?: number;
    idleTimeout?: number;
    backpressureLimit?: number;
    compression?: boolean;
}
export declare class WebSocketServer {
    private clients;
    private rooms;
    private handlers;
    private config;
    private onOpenHandlers;
    private onCloseHandlers;
    private onErrorHandlers;
    constructor(config?: WebSocketConfig);
    /**
     * Generate unique client ID
     */
    private generateId;
    /**
     * Get Bun WebSocket handler config
     */
    getWebSocketHandler(): {
        open: (ws: ServerWebSocket<WebSocketData>) => void;
        message: (ws: ServerWebSocket<WebSocketData>, message: string | Buffer) => Promise<void>;
        close: (ws: ServerWebSocket<WebSocketData>) => void;
        error: (ws: ServerWebSocket<WebSocketData>, error: Error) => void;
    };
    /**
     * Register handler for a specific event
     */
    on(event: string, handler: WebSocketHandler): this;
    /**
     * Handle connection open
     */
    onOpen(handler: WebSocketEventHandler): this;
    /**
     * Handle connection close
     */
    onClose(handler: WebSocketEventHandler): this;
    /**
     * Handle errors
     */
    onError(handler: (ws: ServerWebSocket<WebSocketData>, error: Error) => void): this;
    /**
     * Join a room
     */
    joinRoom(ws: ServerWebSocket<WebSocketData>, roomName: string): void;
    /**
     * Leave a room
     */
    leaveRoom(ws: ServerWebSocket<WebSocketData>, roomName: string): void;
    /**
     * Get clients in a room
     */
    getRoomClients(roomName: string): ServerWebSocket<WebSocketData>[];
    /**
     * Get all room names
     */
    getRooms(): string[];
    /**
     * Broadcast to all connected clients
     */
    broadcast(message: string | object, exclude?: string[]): void;
    /**
     * Broadcast to a specific room
     */
    broadcastToRoom(roomName: string, message: string | object, exclude?: string[]): void;
    /**
     * Send to a specific client
     */
    sendTo(clientId: string, message: string | object): boolean;
    /**
     * Send event with data
     */
    emit(event: string, data: unknown, target?: string | string[]): void;
    /**
     * Get client by ID
     */
    getClient(id: string): ServerWebSocket<WebSocketData> | undefined;
    /**
     * Get all clients
     */
    getClients(): ServerWebSocket<WebSocketData>[];
    /**
     * Get client count
     */
    getClientCount(): number;
    /**
     * Find clients by user ID
     */
    findByUserId(userId: string | number): ServerWebSocket<WebSocketData>[];
    /**
     * Disconnect a client
     */
    disconnect(clientId: string, code?: number, reason?: string): boolean;
    /**
     * Disconnect all clients
     */
    disconnectAll(code?: number, reason?: string): void;
    /**
     * Associate a WebSocket with a user ID
     */
    setUserId(ws: ServerWebSocket<WebSocketData>, userId: string | number): void;
    /**
     * Get user ID from WebSocket
     */
    getUserId(ws: ServerWebSocket<WebSocketData>): string | number | undefined;
    /**
     * Set metadata on a client
     */
    setMetadata(ws: ServerWebSocket<WebSocketData>, key: string, value: unknown): void;
    /**
     * Get metadata from a client
     */
    getMetadata(ws: ServerWebSocket<WebSocketData>, key: string): unknown;
    /**
     * Get path for this WebSocket server
     */
    getPath(): string;
}
export declare const ws: WebSocketServer;
export declare function createWebSocketServer(config?: WebSocketConfig): WebSocketServer;
export default ws;
