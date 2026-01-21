/**
 * Phase 9: Testing Helpers Verification Tests
 */

import { expect, test, describe } from "bun:test";
import { 
  HttpTest, 
  createHttpTest, 
  TestCase 
} from '../src/testing/TestHelper';

describe('Test Helpers', () => {

  test('HttpTest can be instantiated', () => {
    const appMock = {};
    const http = createHttpTest(appMock);
    expect(http).toBeInstanceOf(HttpTest);
  });

  test('HttpTest Helper sets headers', () => {
    const appMock = {};
    const http = new HttpTest(appMock);
    
    http.withHeaders({ 'X-Test': 'true' });
    http.withToken('secret-token');

    // Access private headers for verification (casting to any)
    const headers = (http as any).headers;
    
    expect(headers['X-Test']).toBe('true');
    expect(headers['Authorization']).toBe('Bearer secret-token');
  });

  test('TestCase class exists', () => {
    expect(TestCase).toBeDefined();
    expect(typeof TestCase.setup).toBe('function');
  });

  test('HttpTest throws if app has no fetch method', async () => {
    const appMock = {};
    const http = new HttpTest(appMock);
    
    try {
      await http.get('/');
      expect(true).toBe(false); // Should not reach here
    } catch (e: any) {
      expect(e.message).toContain('fetch() method');
    }
  });

  test('HttpTest calls app.fetch', async () => {
    // Mock app with fetch
    const mockRes = {
      status: 200,
      text: async () => '{"ok": true}',
      headers: new Map([['content-type', 'application/json']])
    };

    const appMock = {
      fetch: async (req: Request) => {
        expect(req.url).toBe('http://localhost/test');
        expect(req.method).toBe('GET');
        return mockRes;
      }
    };

    const http = new HttpTest(appMock);
    const response = await http.get('/test');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    
    // Test assertions
    response.assertStatus(200);
    response.assertJson({ ok: true });
    response.assertHeader('content-type', 'application/json');
  });
});
