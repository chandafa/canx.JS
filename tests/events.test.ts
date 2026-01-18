import { describe, expect, test, beforeEach } from 'bun:test';
import { events, EventEmitter, createEventEmitter, Listen, getEventListeners, EventServiceProvider } from '../src/events/EventEmitter';

describe('EventEmitter', () => {
  describe('Basic Events', () => {
    let emitter: EventEmitter<{ test: string; data: { id: number } }>;

    beforeEach(() => {
      emitter = createEventEmitter<{ test: string; data: { id: number } }>();
    });

    test('should emit and receive events', () => {
      let received = '';
      emitter.on('test', (payload) => {
        received = payload;
      });
      
      emitter.emit('test', 'hello');
      expect(received).toBe('hello');
    });

    test('should handle multiple listeners', () => {
      const results: string[] = [];
      
      emitter.on('test', () => results.push('first'));
      emitter.on('test', () => results.push('second'));
      
      emitter.emit('test', 'data');
      expect(results).toEqual(['first', 'second']);
    });

    test('should unsubscribe using returned function', () => {
      let count = 0;
      const unsubscribe = emitter.on('test', () => count++);
      
      emitter.emit('test', 'a');
      expect(count).toBe(1);
      
      unsubscribe();
      emitter.emit('test', 'b');
      expect(count).toBe(1);
    });

    test('once should fire only once', () => {
      let count = 0;
      emitter.once('test', () => count++);
      
      emitter.emit('test', 'a');
      emitter.emit('test', 'b');
      
      expect(count).toBe(1);
    });

    test('should remove listener with off', () => {
      let count = 0;
      const handler = () => count++;
      
      emitter.on('test', handler);
      emitter.emit('test', 'a');
      expect(count).toBe(1);
      
      emitter.off('test', handler);
      emitter.emit('test', 'b');
      expect(count).toBe(1);
    });
  });

  describe('Async Events', () => {
    test('emitAsync should wait for all handlers', async () => {
      const emitter = createEventEmitter<{ async: string }>();
      const results: number[] = [];
      
      emitter.on('async', async () => {
        await new Promise(r => setTimeout(r, 10));
        results.push(1);
      });
      
      emitter.on('async', async () => {
        results.push(2);
      });
      
      await emitter.emitAsync('async', 'data');
      expect(results.length).toBe(2);
    });
  });

  describe('Priority', () => {
    test('should execute handlers in priority order', () => {
      const emitter = createEventEmitter<{ priority: string }>();
      const results: string[] = [];
      
      emitter.on('priority', () => results.push('low'), { priority: 1 });
      emitter.on('priority', () => results.push('high'), { priority: 10 });
      emitter.on('priority', () => results.push('medium'), { priority: 5 });
      
      emitter.emit('priority', 'test');
      expect(results).toEqual(['high', 'medium', 'low']);
    });
  });

  describe('Listener Management', () => {
    test('listenerCount should return correct count', () => {
      const emitter = createEventEmitter<{ count: string }>();
      
      expect(emitter.listenerCount('count')).toBe(0);
      
      emitter.on('count', () => {});
      emitter.on('count', () => {});
      
      expect(emitter.listenerCount('count')).toBe(2);
    });

    test('eventNames should return registered events', () => {
      const emitter = createEventEmitter<{ a: string; b: number }>();
      
      emitter.on('a', () => {});
      emitter.on('b', () => {});
      
      expect(emitter.eventNames()).toContain('a');
      expect(emitter.eventNames()).toContain('b');
    });

    test('removeAllListeners should clear all', () => {
      const emitter = createEventEmitter<{ clear: string }>();
      
      emitter.on('clear', () => {});
      emitter.on('clear', () => {});
      
      emitter.removeAllListeners('clear');
      expect(emitter.listenerCount('clear')).toBe(0);
    });
  });

  describe('Wildcard Listeners', () => {
    test('onAny should receive all events', () => {
      const emitter = createEventEmitter<{ a: string; b: number }>();
      const received: string[] = [];
      
      emitter.onAny((data) => {
        received.push(data.event);
      });
      
      emitter.emit('a', 'hello');
      emitter.emit('b', 42);
      
      expect(received).toContain('a');
      expect(received).toContain('b');
    });
  });

  describe('Singleton Events', () => {
    test('events singleton should work', () => {
      let received = false;
      events.on('singleton-test', () => {
        received = true;
      });
      
      events.emit('singleton-test', {});
      expect(received).toBe(true);
      
      events.removeAllListeners('singleton-test');
    });
  });
});
