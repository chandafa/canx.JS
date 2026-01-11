/**
 * CanxJS HotWire - Real-time streaming protocol without WebSocket setup
 * Unique feature: Server-sent events with partial HTML updates
 */

import type { HotWireConfig, HotWireStream, CanxRequest, CanxResponse } from '../types';

interface HotWireClient {
  id: string;
  stream: HotWireStream;
  channels: Set<string>;
  lastPing: number;
}

class HotWireManager {
  private clients: Map<string, HotWireClient> = new Map();
  private channels: Map<string, Set<string>> = new Map();
  private config: HotWireConfig;
  private pingInterval: Timer | null = null;

  constructor(config: HotWireConfig = {}) {
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
  createStream(req: CanxRequest, res: CanxResponse): Response {
    const clientId = `hw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array>;

    const stream = new ReadableStream<Uint8Array>({
      start: (ctrl) => {
        controller = ctrl;

        const hotWireStream: HotWireStream = {
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
  subscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.channels.add(channel);
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(clientId);
  }

  /**
   * Unsubscribe client from channel
   */
  unsubscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (client) client.channels.delete(channel);

    const channelClients = this.channels.get(channel);
    if (channelClients) {
      channelClients.delete(clientId);
      if (channelClients.size === 0) this.channels.delete(channel);
    }
  }

  /**
   * Broadcast to all clients in channel
   */
  broadcast(channel: string, data: string | object): void {
    const clientIds = this.channels.get(channel);
    if (!clientIds) return;

    clientIds.forEach((id) => {
      const client = this.clients.get(id);
      if (client) client.stream.send(data);
    });
  }

  /**
   * Broadcast HTML update to channel
   */
  broadcastHTML(channel: string, html: string, target: string, action: 'replace' | 'append' | 'prepend' = 'replace'): void {
    const clientIds = this.channels.get(channel);
    if (!clientIds) return;

    clientIds.forEach((id) => {
      const client = this.clients.get(id);
      if (client) client.stream.sendHTML(html, target, action);
    });
  }

  /**
   * Send to specific client
   */
  sendTo(clientId: string, data: string | object): void {
    const client = this.clients.get(clientId);
    if (client) client.stream.send(data);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastAll(data: string | object): void {
    this.clients.forEach((client) => client.stream.send(data));
  }

  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.channels.forEach((channel) => {
        this.channels.get(channel)?.delete(clientId);
      });
      this.clients.delete(clientId);
    }
  }

  private pingClients(): void {
    const now = Date.now();
    this.clients.forEach((client, id) => {
      if (now - client.lastPing > 60000) {
        this.removeClient(id);
      } else {
        try {
          client.stream.send({ type: 'ping', timestamp: now });
          client.lastPing = now;
        } catch {
          this.removeClient(id);
        }
      }
    });
  }

  getStats(): { clients: number; channels: number } {
    return { clients: this.clients.size, channels: this.channels.size };
  }

  destroy(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.clients.forEach((c) => c.stream.close());
    this.clients.clear();
    this.channels.clear();
  }
}

export const hotWire = new HotWireManager();

export function createHotWire(config?: HotWireConfig): HotWireManager {
  return new HotWireManager(config);
}

export default hotWire;
