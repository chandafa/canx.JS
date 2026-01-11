/**
 * CanxJS Channel - Real-time Pub/Sub System
 */

import type { CanxRequest, CanxResponse } from '../types';

interface ChannelClient {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  channels: Set<string>;
  metadata: Record<string, unknown>;
}

interface ChannelMessage {
  channel: string;
  event: string;
  data: unknown;
  timestamp: number;
}

class ChannelManager {
  private clients: Map<string, ChannelClient> = new Map();
  private channels: Map<string, Set<string>> = new Map();
  private encoder = new TextEncoder();

  /**
   * Create SSE stream for client
   */
  connect(req: CanxRequest, res: CanxResponse, metadata: Record<string, unknown> = {}): Response {
    const clientId = `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const client: ChannelClient = {
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
  disconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all channels
    client.channels.forEach(channel => {
      this.channels.get(channel)?.delete(clientId);
    });

    try { client.controller.close(); } catch {}
    this.clients.delete(clientId);
  }

  /**
   * Subscribe client to channel
   */
  subscribe(clientId: string, channel: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(clientId);
    client.channels.add(channel);

    this.sendToClient(clientId, { type: 'subscribed', channel });
    return true;
  }

  /**
   * Unsubscribe client from channel
   */
  unsubscribe(clientId: string, channel: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    this.channels.get(channel)?.delete(clientId);
    client.channels.delete(channel);

    this.sendToClient(clientId, { type: 'unsubscribed', channel });
    return true;
  }

  /**
   * Broadcast message to all clients in channel
   */
  broadcast(channel: string, event: string, data: unknown): void {
    const clientIds = this.channels.get(channel);
    if (!clientIds) return;

    const message: ChannelMessage = {
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
  sendTo(clientId: string, event: string, data: unknown): boolean {
    return this.sendToClient(clientId, { event, data, timestamp: Date.now() });
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastAll(event: string, data: unknown): void {
    this.clients.forEach((_, id) => {
      this.sendToClient(id, { event, data, timestamp: Date.now() });
    });
  }

  private sendToClient(clientId: string, message: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      const data = JSON.stringify(message);
      client.controller.enqueue(this.encoder.encode(`data: ${data}\n\n`));
      return true;
    } catch {
      this.disconnect(clientId);
      return false;
    }
  }

  /**
   * Get channel subscribers count
   */
  getChannelSize(channel: string): number {
    return this.channels.get(channel)?.size || 0;
  }

  /**
   * Get all channels
   */
  getChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client info
   */
  getClient(clientId: string): { channels: string[]; metadata: Record<string, unknown> } | null {
    const client = this.clients.get(clientId);
    if (!client) return null;
    return { channels: Array.from(client.channels), metadata: client.metadata };
  }

  /**
   * Get stats
   */
  stats(): { clients: number; channels: number; subscriptions: number } {
    let subscriptions = 0;
    this.channels.forEach(clients => subscriptions += clients.size);
    return {
      clients: this.clients.size,
      channels: this.channels.size,
      subscriptions,
    };
  }
}

export const channel = new ChannelManager();

export function createChannel(): ChannelManager {
  return new ChannelManager();
}

export default channel;
