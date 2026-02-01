"use strict";
/**
 * CanxJS HotWire - Real-time streaming protocol without WebSocket setup
 * Unique feature: Server-sent events with partial HTML updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hotWire = void 0;
exports.createHotWire = createHotWire;
class HotWireManager {
    clients = new Map();
    channels = new Map();
    config;
    pingInterval = null;
    constructor(config = {}) {
        this.config = {
            enabled: true,
            reconnectInterval: 3000,
            maxConnections: 1000,
            ...config,
        };
        // Start ping interval to keep connections alive
        if (this.config.enabled) {
            this.pingInterval = setInterval(() => this.pingClients(), 30000);
        }
    }
    /**
     * Create SSE stream for client
     */
    createStream(req, res) {
        const clientId = `hw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const encoder = new TextEncoder();
        let controller;
        const stream = new ReadableStream({
            start: (ctrl) => {
                controller = ctrl;
                const hotWireStream = {
                    send: (data) => {
                        const payload = typeof data === 'object' ? JSON.stringify(data) : data;
                        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                    },
                    sendHTML: (html, target, action = 'replace') => {
                        const payload = JSON.stringify({ type: 'html', target, action, content: html });
                        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                    },
                    close: () => {
                        this.removeClient(clientId);
                        controller.close();
                    },
                    onClose: (cb) => {
                        // Store callback for cleanup
                    },
                };
                this.clients.set(clientId, {
                    id: clientId,
                    stream: hotWireStream,
                    channels: new Set(),
                    lastPing: Date.now(),
                });
                // Send initial connection message
                controller.enqueue(encoder.encode(`data: {"type":"connected","id":"${clientId}"}\n\n`));
            },
            cancel: () => {
                this.removeClient(clientId);
            },
        });
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-HotWire-Client': clientId,
            },
        });
    }
    /**
     * Subscribe client to channel
     */
    subscribe(clientId, channel) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        client.channels.add(channel);
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set());
        }
        this.channels.get(channel).add(clientId);
    }
    /**
     * Unsubscribe client from channel
     */
    unsubscribe(clientId, channel) {
        const client = this.clients.get(clientId);
        if (client)
            client.channels.delete(channel);
        const channelClients = this.channels.get(channel);
        if (channelClients) {
            channelClients.delete(clientId);
            if (channelClients.size === 0)
                this.channels.delete(channel);
        }
    }
    /**
     * Broadcast to all clients in channel
     */
    broadcast(channel, data) {
        const clientIds = this.channels.get(channel);
        if (!clientIds)
            return;
        clientIds.forEach((id) => {
            const client = this.clients.get(id);
            if (client)
                client.stream.send(data);
        });
    }
    /**
     * Broadcast HTML update to channel
     */
    broadcastHTML(channel, html, target, action = 'replace') {
        const clientIds = this.channels.get(channel);
        if (!clientIds)
            return;
        clientIds.forEach((id) => {
            const client = this.clients.get(id);
            if (client)
                client.stream.sendHTML(html, target, action);
        });
    }
    /**
     * Send to specific client
     */
    sendTo(clientId, data) {
        const client = this.clients.get(clientId);
        if (client)
            client.stream.send(data);
    }
    /**
     * Broadcast to all connected clients
     */
    broadcastAll(data) {
        this.clients.forEach((client) => client.stream.send(data));
    }
    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.channels.forEach((channel) => {
                this.channels.get(channel)?.delete(clientId);
            });
            this.clients.delete(clientId);
        }
    }
    pingClients() {
        const now = Date.now();
        this.clients.forEach((client, id) => {
            if (now - client.lastPing > 60000) {
                this.removeClient(id);
            }
            else {
                try {
                    client.stream.send({ type: 'ping', timestamp: now });
                    client.lastPing = now;
                }
                catch {
                    this.removeClient(id);
                }
            }
        });
    }
    getStats() {
        return { clients: this.clients.size, channels: this.channels.size };
    }
    destroy() {
        if (this.pingInterval)
            clearInterval(this.pingInterval);
        this.clients.forEach((c) => c.stream.close());
        this.clients.clear();
        this.channels.clear();
    }
}
exports.hotWire = new HotWireManager();
function createHotWire(config) {
    return new HotWireManager(config);
}
exports.default = exports.hotWire;
