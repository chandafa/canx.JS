/**
 * CanxJS Router Unit Tests
 */
import { describe, test, expect } from 'bun:test';
import { createRouter, Router } from '../src/core/Router';

describe('Router', () => {
  test('should create a router instance', () => {
    const router = createRouter();
    expect(router).toBeInstanceOf(Router);
  });

  test('should register GET route', () => {
    const router = createRouter();
    router.get('/users', () => new Response('users'));
    
    const match = router.match('GET', '/users');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({});
  });

  test('should register POST route', () => {
    const router = createRouter();
    router.post('/users', () => new Response('created'));
    
    const match = router.match('POST', '/users');
    expect(match).not.toBeNull();
  });

  test('should handle route parameters', () => {
    const router = createRouter();
    router.get('/users/:id', (req) => new Response(`User ${req.params.id}`));
    
    const match = router.match('GET', '/users/123');
    expect(match).not.toBeNull();
    expect(match?.params.id).toBe('123');
  });

  test('should handle multiple parameters', () => {
    const router = createRouter();
    router.get('/posts/:postId/comments/:commentId', () => new Response('comment'));
    
    const match = router.match('GET', '/posts/5/comments/10');
    expect(match).not.toBeNull();
    // Param names should preserve original casing
    expect(match?.params.postId).toBe('5');
    expect(match?.params.commentId).toBe('10');
  });

  test('should handle wildcard routes', () => {
    const router = createRouter();
    router.get('/files/*path', () => new Response('file'));
    
    const match = router.match('GET', '/files/docs/readme.md');
    expect(match).not.toBeNull();
    expect(match?.params.path).toBe('docs/readme.md');
  });

  test('should return null for unmatched routes', () => {
    const router = createRouter();
    router.get('/users', () => new Response('users'));
    
    const match = router.match('GET', '/posts');
    expect(match).toBeNull();
  });

  test('should handle route groups', () => {
    const router = createRouter();
    router.group('/api', (r) => {
      r.get('/users', () => new Response('api users'));
      r.get('/posts', () => new Response('api posts'));
    });
    
    expect(router.match('GET', '/api/users')).not.toBeNull();
    expect(router.match('GET', '/api/posts')).not.toBeNull();
    expect(router.match('GET', '/users')).toBeNull();
  });

  test('should handle ALL routes', () => {
    const router = createRouter();
    router.all('/any', () => new Response('any'));
    
    expect(router.match('GET', '/any')).not.toBeNull();
    expect(router.match('POST', '/any')).not.toBeNull();
    expect(router.match('DELETE', '/any')).not.toBeNull();
  });

  test('should list all routes', () => {
    const router = createRouter();
    router.get('/users', () => new Response(''));
    router.post('/users', () => new Response(''));
    router.get('/posts', () => new Response(''));
    
    const routes = router.getRoutes();
    expect(routes.length).toBe(3);
  });

  test('should handle resource routes', () => {
    const controller = {
      index: () => new Response('list'),
      show: () => new Response('show'),
      store: () => new Response('create'),
      update: () => new Response('update'),
      destroy: () => new Response('delete'),
    };
    
    const router = createRouter();
    router.resource('/posts', controller);
    
    expect(router.match('GET', '/posts')).not.toBeNull();
    expect(router.match('GET', '/posts/1')).not.toBeNull();
    expect(router.match('POST', '/posts')).not.toBeNull();
    expect(router.match('PUT', '/posts/1')).not.toBeNull();
    expect(router.match('DELETE', '/posts/1')).not.toBeNull();
  });
});
