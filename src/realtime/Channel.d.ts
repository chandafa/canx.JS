/**
 * CanxJS Channel - Real-time Pub/Sub System
 */
import type { CanxRequest, CanxResponse } from '../types';
declare class ChannelManager {
    private clients;
    private channels;
    private encoder;
    /**
     * Create SSE stream for client
     */
    connect(req: CanxRequest, res: CanxResponse, metadata?: Record<string, unknown>): Response;
    /**
     * Disconnect client
     */
    disconnect(clientId: string): void;
    /**
     * Subscribe client to channel
     */
    subscribe(clientId: string, channel: string): boolean;
    /**
     * Unsubscribe client from channel
     */
    unsubscribe(clientId: string, channel: string): boolean;
    /**
     * Broadcast message to all clients in channel
     */
    broadcast(channel: string, event: string, data: unknown): void;
    /**
     * Send to specific client
     */
    sendTo(clientId: string, event: string, data: unknown): boolean;
    /**
     * Broadcast to all connected clients
     */
    broadcastAll(event: string, data: unknown): void;
    private sendToClient;
    /**
     * Get channel subscribers count
     */
    getChannelSize(channel: string): number;
    /**
     * Get all channels
     */
    getChannels(): string[];
    /**
     * Get connected clients count
     */
    getClientCount(): number;
    /**
     * Get client info
     */
    getClient(clientId: string): {
        channels: string[];
        metadata: Record<string, unknown>;
    } | null;
    /**
     * Get stats
     */
    stats(): {
        clients: number;
        channels: number;
        subscriptions: number;
    };
}
export declare const channel: ChannelManager;
export declare function createChannel(): ChannelManager;
export default channel;
