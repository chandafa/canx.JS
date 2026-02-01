"use strict";
/**
 * CanxJS WebSocket - Full WebSocket support with rooms and channels
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ws = exports.WebSocketServer = void 0;
exports.createWebSocketServer = createWebSocketServer;
// ============================================
// WebSocket Server
// ============================================
class WebSocketServer {
    clients = new Map();
    rooms = new Map();
    handlers = new Map();
    config;
    // Event handlers
    onOpenHandlers = [];
    onCloseHandlers = [];
    onErrorHandlers = [];
    constructor(config = {}) {
        this.config = {
            path: '/ws',
            maxPayloadLength: 16 * 1024 * 1024, // 16MB
            idleTimeout: 120,
            backpressureLimit: 1024 * 1024, // 1MB
            compression: true,
            ...config,
        };
    }
    /**
     * Generate unique client ID
     */
    generateId() {
        return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    }
    /**
     * Get Bun WebSocket handler config
     */
    getWebSocketHandler() {
        return {
            open: (ws) => {
                const id = this.generateId();
                ws.data = {
                    id,
                    rooms: new Set(),
                    metadata: {},
                };
                this.clients.set(id, ws);
                for (const handler of this.onOpenHandlers) {
                    handler(ws);
                }
                console.log(`[WebSocket] Client connected: ${id}`);
            },
            message: async (ws, message) => {
                try {
                    const data = typeof message === 'string' ? message : message.toString();
                    // Try to parse as JSON for event-based messaging
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.event && this.handlers.has(parsed.event)) {
                            const handler = this.handlers.get(parsed.event);
                            await handler(ws, JSON.stringify(parsed.data || {}));
                            return;
                        }
                    }
                    catch {
                        // Not JSON, treat as raw message
                    }
                    // Call default message handler if exists
                    if (this.handlers.has('message')) {
                        await this.handlers.get('message')(ws, message);
                    }
                }
                catch (error) {
                    console.error('[WebSocket] Message handler error:', error);
                }
            },
            close: (ws) => {
                const id = ws.data.id;
                // Leave all rooms
                for (const roomName of ws.data.rooms) {
                    this.leaveRoom(ws, roomName);
                }
                this.clients.delete(id);
                for (const handler of this.onCloseHandlers) {
                    handler(ws);
                }
                console.log(`[WebSocket] Client disconnected: ${id}`);
            },
            error: (ws, error) => {
                console.error(`[WebSocket] Error for ${ws.data.id}:`, error);
                for (const handler of this.onErrorHandlers) {
                    handler(ws, error);
                }
            },
        };
    }
    // ============================================
    // Event Handlers
    // ============================================
    /**
     * Register handler for a specific event
     */
    on(event, handler) {
        this.handlers.set(event, handler);
        return this;
    }
    /**
     * Handle connection open
     */
    onOpen(handler) {
        this.onOpenHandlers.push(handler);
        return this;
    }
    /**
     * Handle connection close
     */
    onClose(handler) {
        this.onCloseHandlers.push(handler);
        return this;
    }
    /**
     * Handle errors
     */
    onError(handler) {
        this.onErrorHandlers.push(handler);
        return this;
    }
    // ============================================
    // Room Management
    // ============================================
    /**
     * Join a room
     */
    joinRoom(ws, roomName) {
        ws.data.rooms.add(roomName);
        let room = this.rooms.get(roomName);
        if (!room) {
            room = new Set();
            this.rooms.set(roomName, room);
        }
        room.add(ws.data.id);
        // Also subscribe to Bun's built-in pub/sub
        ws.subscribe(roomName);
    }
    /**
     * Leave a room
     */
    leaveRoom(ws, roomName) {
        ws.data.rooms.delete(roomName);
        const room = this.rooms.get(roomName);
        if (room) {
            room.delete(ws.data.id);
            if (room.size === 0) {
                this.rooms.delete(roomName);
            }
        }
        ws.unsubscribe(roomName);
    }
    /**
     * Get clients in a room
     */
    getRoomClients(roomName) {
        const room = this.rooms.get(roomName);
        if (!room)
            return [];
        return Array.from(room)
            .map(id => this.clients.get(id))
            .filter((ws) => ws !== undefined);
    }
    /**
     * Get all room names
     */
    getRooms() {
        return Array.from(this.rooms.keys());
    }
    // ============================================
    // Broadcasting
    // ============================================
    /**
     * Broadcast to all connected clients
     */
    broadcast(message, exclude) {
        const data = typeof message === 'object' ? JSON.stringify(message) : message;
        for (const [id, ws] of this.clients) {
            if (!exclude || !exclude.includes(id)) {
                ws.send(data);
            }
        }
    }
    /**
     * Broadcast to a specific room
     */
    broadcastToRoom(roomName, message, exclude) {
        const data = typeof message === 'object' ? JSON.stringify(message) : message;
        const room = this.rooms.get(roomName);
        if (!room)
            return;
        for (const id of room) {
            if (!exclude || !exclude.includes(id)) {
                const ws = this.clients.get(id);
                ws?.send(data);
            }
        }
    }
    /**
     * Send to a specific client
     */
    sendTo(clientId, message) {
        const ws = this.clients.get(clientId);
        if (!ws)
            return false;
        const data = typeof message === 'object' ? JSON.stringify(message) : message;
        ws.send(data);
        return true;
    }
    /**
     * Send event with data
     */
    emit(event, data, target) {
        const message = JSON.stringify({ event, data });
        if (!target) {
            this.broadcast(message);
        }
        else if (typeof target === 'string') {
            // Could be client ID or room name
            if (this.clients.has(target)) {
                this.sendTo(target, message);
            }
            else if (this.rooms.has(target)) {
                this.broadcastToRoom(target, message);
            }
        }
        else {
            for (const t of target) {
                this.sendTo(t, message);
            }
        }
    }
    // ============================================
    // Client Management
    // ============================================
    /**
     * Get client by ID
     */
    getClient(id) {
        return this.clients.get(id);
    }
    /**
     * Get all clients
     */
    getClients() {
        return Array.from(this.clients.values());
    }
    /**
     * Get client count
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Find clients by user ID
     */
    findByUserId(userId) {
        return Array.from(this.clients.values())
            .filter(ws => ws.data.userId === userId);
    }
    /**
     * Disconnect a client
     */
    disconnect(clientId, code, reason) {
        const ws = this.clients.get(clientId);
        if (!ws)
            return false;
        ws.close(code, reason);
        return true;
    }
    /**
     * Disconnect all clients
     */
    disconnectAll(code, reason) {
        for (const ws of this.clients.values()) {
            ws.close(code, reason);
        }
    }
    // ============================================
    // User Association
    // ============================================
    /**
     * Associate a WebSocket with a user ID
     */
    setUserId(ws, userId) {
        ws.data.userId = userId;
    }
    /**
     * Get user ID from WebSocket
     */
    getUserId(ws) {
        return ws.data.userId;
    }
    // ============================================
    // Metadata
    // ============================================
    /**
     * Set metadata on a client
     */
    setMetadata(ws, key, value) {
        ws.data.metadata[key] = value;
    }
    /**
     * Get metadata from a client
     */
    getMetadata(ws, key) {
        return ws.data.metadata[key];
    }
    /**
     * Get path for this WebSocket server
     */
    getPath() {
        return this.config.path;
    }
}
exports.WebSocketServer = WebSocketServer;
// ============================================
// Singleton & Exports
// ============================================
exports.ws = new WebSocketServer();
function createWebSocketServer(config) {
    return new WebSocketServer(config);
}
exports.default = exports.ws;
