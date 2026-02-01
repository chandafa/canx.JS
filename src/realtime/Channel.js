"use strict";
/**
 * CanxJS Channel - Real-time Pub/Sub System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.channel = void 0;
exports.createChannel = createChannel;
class ChannelManager {
    clients = new Map();
    channels = new Map();
    encoder = new TextEncoder();
    /**
     * Create SSE stream for client
     */
    connect(req, res, metadata = {}) {
        const clientId = `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
        const stream = new ReadableStream({
            start: (controller) => {
                const client = {
                    id: clientId,
                    controller,
                    channels: new Set(),
                    metadata,
                };
                this.clients.set(clientId, client);
                // Send connection message
                this.sendToClient(clientId, { type: 'connected', id: clientId });
            },
            cancel: () => {
                this.disconnect(clientId);
            },
        });
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Client-Id': clientId,
            },
        });
    }
    /**
     * Disconnect client
     */
    disconnect(clientId) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        // Remove from all channels
        client.channels.forEach(channel => {
            this.channels.get(channel)?.delete(clientId);
        });
        try {
            client.controller.close();
        }
        catch { }
        this.clients.delete(clientId);
    }
    /**
     * Subscribe client to channel
     */
    subscribe(clientId, channel) {
        const client = this.clients.get(clientId);
        if (!client)
            return false;
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set());
        }
        this.channels.get(channel).add(clientId);
        client.channels.add(channel);
        this.sendToClient(clientId, { type: 'subscribed', channel });
        return true;
    }
    /**
     * Unsubscribe client from channel
     */
    unsubscribe(clientId, channel) {
        const client = this.clients.get(clientId);
        if (!client)
            return false;
        this.channels.get(channel)?.delete(clientId);
        client.channels.delete(channel);
        this.sendToClient(clientId, { type: 'unsubscribed', channel });
        return true;
    }
    /**
     * Broadcast message to all clients in channel
     */
    broadcast(channel, event, data) {
        const clientIds = this.channels.get(channel);
        if (!clientIds)
            return;
        const message = {
            channel,
            event,
            data,
            timestamp: Date.now(),
        };
        clientIds.forEach(id => this.sendToClient(id, message));
    }
    /**
     * Send to specific client
     */
    sendTo(clientId, event, data) {
        return this.sendToClient(clientId, { event, data, timestamp: Date.now() });
    }
    /**
     * Broadcast to all connected clients
     */
    broadcastAll(event, data) {
        this.clients.forEach((_, id) => {
            this.sendToClient(id, { event, data, timestamp: Date.now() });
        });
    }
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client)
            return false;
        try {
            const data = JSON.stringify(message);
            client.controller.enqueue(this.encoder.encode(`data: ${data}\n\n`));
            return true;
        }
        catch {
            this.disconnect(clientId);
            return false;
        }
    }
    /**
     * Get channel subscribers count
     */
    getChannelSize(channel) {
        return this.channels.get(channel)?.size || 0;
    }
    /**
     * Get all channels
     */
    getChannels() {
        return Array.from(this.channels.keys());
    }
    /**
     * Get connected clients count
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Get client info
     */
    getClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client)
            return null;
        return { channels: Array.from(client.channels), metadata: client.metadata };
    }
    /**
     * Get stats
     */
    stats() {
        let subscriptions = 0;
        this.channels.forEach(clients => subscriptions += clients.size);
        return {
            clients: this.clients.size,
            channels: this.channels.size,
            subscriptions,
        };
    }
}
exports.channel = new ChannelManager();
function createChannel() {
    return new ChannelManager();
}
exports.default = exports.channel;
