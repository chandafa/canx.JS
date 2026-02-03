/**
 * WebSocket Server Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { WebSocketServer, createWebSocketServer, ws } from '../src/realtime/WebSocket';

// ============================================
// Test: WebSocketServer Class
// ============================================

describe('WebSocketServer', () => {
  let wsServer: WebSocketServer;
  
  beforeEach(() => {
    wsServer = new WebSocketServer();
  });

  test('should create instance with default config', () => {
    expect(wsServer).toBeInstanceOf(WebSocketServer);
  });

  test('should create instance with custom config', () => {
    const server = new WebSocketServer({
      path: '/ws',
      maxPayloadLength: 1024 * 1024,
      idleTimeout: 120,
      compression: true
    });
    
    expect(server).toBeInstanceOf(WebSocketServer);
    expect(server.getPath()).toBe('/ws');
  });

  test('should have on() method for event registration', () => {
    expect(typeof wsServer.on).toBe('function');
  });

  test('on() should be chainable', () => {
    const result = wsServer
      .on('chat', () => {})
      .on('join', () => {});
    
    expect(result).toBe(wsServer);
  });

  test('should have onOpen() method', () => {
    expect(typeof wsServer.onOpen).toBe('function');
  });

  test('onOpen() should be chainable', () => {
    const result = wsServer.onOpen(() => {});
    expect(result).toBe(wsServer);
  });

  test('should have onClose() method', () => {
    expect(typeof wsServer.onClose).toBe('function');
  });

  test('onClose() should be chainable', () => {
    const result = wsServer.onClose(() => {});
    expect(result).toBe(wsServer);
  });

  test('should have onError() method', () => {
    expect(typeof wsServer.onError).toBe('function');
  });

  test('onError() should be chainable', () => {
    const result = wsServer.onError(() => {});
    expect(result).toBe(wsServer);
  });
});

// ============================================
// Test: Room Management
// ============================================

describe('WebSocketServer Room Management', () => {
  let wsServer: WebSocketServer;
  
  beforeEach(() => {
    wsServer = new WebSocketServer();
  });

  test('should have joinRoom() method', () => {
    expect(typeof wsServer.joinRoom).toBe('function');
  });

  test('should have leaveRoom() method', () => {
    expect(typeof wsServer.leaveRoom).toBe('function');
  });

  test('should have getRoomClients() method', () => {
    expect(typeof wsServer.getRoomClients).toBe('function');
  });

  test('should have getRooms() method', () => {
    expect(typeof wsServer.getRooms).toBe('function');
  });

  test('getRooms() should return empty array initially', () => {
    const rooms = wsServer.getRooms();
    expect(Array.isArray(rooms)).toBe(true);
    expect(rooms.length).toBe(0);
  });

  test('getRoomClients() should return empty array for non-existent room', () => {
    const clients = wsServer.getRoomClients('non-existent');
    expect(Array.isArray(clients)).toBe(true);
    expect(clients.length).toBe(0);
  });
});

// ============================================
// Test: Broadcasting
// ============================================

describe('WebSocketServer Broadcasting', () => {
  let wsServer: WebSocketServer;
  
  beforeEach(() => {
    wsServer = new WebSocketServer();
  });

  test('should have broadcast() method', () => {
    expect(typeof wsServer.broadcast).toBe('function');
  });

  test('should have broadcastToRoom() method', () => {
    expect(typeof wsServer.broadcastToRoom).toBe('function');
  });

  test('should have sendTo() method', () => {
    expect(typeof wsServer.sendTo).toBe('function');
  });

  test('should have emit() method', () => {
    expect(typeof wsServer.emit).toBe('function');
  });

  test('sendTo() should return false for non-existent client', () => {
    const result = wsServer.sendTo('non-existent-id', { message: 'hello' });
    expect(result).toBe(false);
  });
});

// ============================================
// Test: Client Management
// ============================================

describe('WebSocketServer Client Management', () => {
  let wsServer: WebSocketServer;
  
  beforeEach(() => {
    wsServer = new WebSocketServer();
  });

  test('should have getClient() method', () => {
    expect(typeof wsServer.getClient).toBe('function');
  });

  test('should have getClients() method', () => {
    expect(typeof wsServer.getClients).toBe('function');
  });

  test('should have getClientCount() method', () => {
    expect(typeof wsServer.getClientCount).toBe('function');
  });

  test('should have findByUserId() method', () => {
    expect(typeof wsServer.findByUserId).toBe('function');
  });

  test('should have disconnect() method', () => {
    expect(typeof wsServer.disconnect).toBe('function');
  });

  test('getClient() should return undefined for non-existent client', () => {
    const client = wsServer.getClient('non-existent');
    expect(client).toBeUndefined();
  });

  test('getClients() should return empty array initially', () => {
    const clients = wsServer.getClients();
    expect(Array.isArray(clients)).toBe(true);
    expect(clients.length).toBe(0);
  });

  test('getClientCount() should return 0 initially', () => {
    const count = wsServer.getClientCount();
    expect(count).toBe(0);
  });

  test('findByUserId() should return empty array for non-existent user', () => {
    const clients = wsServer.findByUserId('user123');
    expect(Array.isArray(clients)).toBe(true);
    expect(clients.length).toBe(0);
  });

  test('disconnect() should return false for non-existent client', () => {
    const result = wsServer.disconnect('non-existent');
    expect(result).toBe(false);
  });
});

// ============================================
// Test: Metadata
// ============================================

describe('WebSocketServer Metadata', () => {
  let wsServer: WebSocketServer;
  
  beforeEach(() => {
    wsServer = new WebSocketServer();
  });

  test('should have setMetadata() method', () => {
    expect(typeof wsServer.setMetadata).toBe('function');
  });

  test('should have getMetadata() method', () => {
    expect(typeof wsServer.getMetadata).toBe('function');
  });
});

// ============================================
// Test: Factory Functions
// ============================================

describe('WebSocket Factory Functions', () => {
  test('createWebSocketServer() should create a new instance', () => {
    const server = createWebSocketServer();
    expect(server).toBeInstanceOf(WebSocketServer);
  });

  test('createWebSocketServer() should accept config', () => {
    const server = createWebSocketServer({
      path: '/socket',
      idleTimeout: 60
    });
    
    expect(server).toBeInstanceOf(WebSocketServer);
    expect(server.getPath()).toBe('/socket');
  });

  test('ws singleton should be defined', () => {
    expect(ws).toBeDefined();
    expect(ws).toBeInstanceOf(WebSocketServer);
  });
});

// ============================================
// Test: WebSocket Handler
// ============================================

describe('WebSocketServer Handler', () => {
  test('getWebSocketHandler() should return handler object', () => {
    const wsServer = new WebSocketServer();
    const handler = wsServer.getWebSocketHandler();
    
    expect(handler).toBeDefined();
    expect(typeof handler.open).toBe('function');
    expect(typeof handler.message).toBe('function');
    expect(typeof handler.close).toBe('function');
  });
});
