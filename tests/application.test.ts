/**
 * CanxJS Application Unit Tests
 */
import { describe, test, expect } from 'bun:test';
import { createApp, Canx, defineConfig } from '../src/Application';

describe('Application', () => {
  test('should create an app instance', () => {
    const app = createApp();
    expect(app).toBeInstanceOf(Canx);
  });

  test('should accept custom port configuration', () => {
    const app = createApp({ port: 8080 });
    expect(app.config.port).toBe(8080);
  });

  test('should register GET routes', () => {
    const app = createApp();
    app.get('/test', () => new Response('ok'));
    
    expect(app.router.match('GET', '/test')).not.toBeNull();
  });

  test('should register POST routes', () => {
    const app = createApp();
    app.post('/test', () => new Response('ok'));
    
    expect(app.router.match('POST', '/test')).not.toBeNull();
  });

  test('should handle routes callback', () => {
    const app = createApp();
    app.routes((router) => {
      router.get('/users', () => new Response('users'));
      router.get('/posts', () => new Response('posts'));
    });
    
    expect(app.router.match('GET', '/users')).not.toBeNull();
    expect(app.router.match('GET', '/posts')).not.toBeNull();
  });

  test('should handle group routes', () => {
    const app = createApp();
    app.group('/api', (router) => {
      router.get('/data', () => new Response('data'));
    });
    
    expect(app.router.match('GET', '/api/data')).not.toBeNull();
  });

  test('should handle resource routes', () => {
    const controller = {
      index: () => new Response('list'),
      show: () => new Response('show'),
      store: () => new Response('create'),
    };
    
    const app = createApp();
    app.resource('/items', controller);
    
    expect(app.router.match('GET', '/items')).not.toBeNull();
    expect(app.router.match('GET', '/items/1')).not.toBeNull();
    expect(app.router.match('POST', '/items')).not.toBeNull();
  });

  test('should handle all() for any HTTP method', () => {
    const app = createApp();
    app.all('/any', () => new Response('any'));
    
    expect(app.router.match('GET', '/any')).not.toBeNull();
    expect(app.router.match('POST', '/any')).not.toBeNull();
    expect(app.router.match('PUT', '/any')).not.toBeNull();
  });
});

describe('defineConfig', () => {
  test('should return the same config object', () => {
    const config = defineConfig({
      port: 3000,
      debug: true,
    });
    
    expect(config.port).toBe(3000);
    expect(config.debug).toBe(true);
  });
});
