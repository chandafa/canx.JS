/**
 * CanxJS Signal Server - WebSocket Gateway for Signals
 * @description Broadcasts Signal updates to connected clients via WebSocket
 */

import { WebSocketGateway } from '../realtime/Decorators';
import { signalRegistry } from './SignalRegistry';
import { eventBus } from '../microservices/EventBus';

/**
 * Signal Sync Protocol
 * Client sends: { type: 'subscribe', key: 'stock-123' }
 * Server sends: { type: 'update', key: 'stock-123', value: 99 }
 */

// Simple in-memory client tracker for demo purposes
// In production, this would use the real WebSocketGateway manager
const clients = new Map<string, Set<WebSocket>>(); 

export class SignalServer {
  private cleanup?: () => void;

  constructor() {
    this.init();
  }

  private async init() {
    // Listen to ALL signal updates from the EventBus (Cluster)
    // Pattern: signal:*
    const bus = eventBus();
    
    // Subscribe to wildcard pattern (if supported by EventBus driver) 
    // or we hook into Signal.set() directly since this runs on every node.
    
    // For now, we rely on the fact that Signal.ts calls broadcastToClients()
    // We need to implement the actual broadcasting mechanism.
  }

  /**
   * Handle client subscription
   */
  handleSubscribe(client: WebSocket, signalKey: string) {
    if (!clients.has(signalKey)) {
      clients.set(signalKey, new Set());
    }
    clients.get(signalKey)!.add(client);

    // Send initial value immediately
    const signal = signalRegistry.get(signalKey);
    if (signal) {
      this.sendUpdate(client, signalKey, signal.value);
    }
  }

  /**
   * Handle client unsubscription
   */
  handleUnsubscribe(client: WebSocket, signalKey: string) {
    if (clients.has(signalKey)) {
      clients.get(signalKey)!.delete(client);
    }
  }

  /**
   * Broadcast update to interested clients
   */
  broadcast(signalKey: string, newValue: any) {
    const interestedClients = clients.get(signalKey);
    if (interestedClients) {
      for (const client of interestedClients) {
        if (client.readyState === WebSocket.OPEN) {
          this.sendUpdate(client, signalKey, newValue);
        }
      }
    }
  }

  private sendUpdate(client: WebSocket, key: string, value: any) {
    client.send(JSON.stringify({
      type: 'signal:update',
      key,
      value,
      timestamp: Date.now()
    }));
  }
}

// Global Signal Server Instance
export const signalServer = new SignalServer();

// Hook for Signal.ts to call
export function broadcastSignalUpdate(key: string, value: any) {
  signalServer.broadcast(key, value);
}
