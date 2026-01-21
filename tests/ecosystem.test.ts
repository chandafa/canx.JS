/**
 * Phase 5: Ecosystem & Tooling Verification Tests
 */

import { expect, test, describe } from "bun:test";

// Import Phase 5 modules
import { 
  Pipeline,
  pipeline,
  createPipe,
  tap,
  when,
  unless,
  transform,
} from '../src/utils/Pipeline';

// ============================================
// Pipeline Tests
// ============================================

describe('Pipeline Pattern', () => {
  
  test('Pipeline can be created', () => {
    const p = pipeline<string>();
    expect(p).toBeInstanceOf(Pipeline);
  });

  test('Pipeline processes data through stages', async () => {
    const result = await pipeline<string>('hello')
      .through([
        async (data, next) => next(data.toUpperCase()),
        async (data, next) => next(data + '!'),
      ])
      .run();
    
    expect(result).toBe('HELLO!');
  });

  test('Pipeline send() sets initial data', async () => {
    const result = await pipeline<number>()
      .send(10)
      .through([
        async (data, next) => next(data * 2),
        async (data, next) => next(data + 5),
      ])
      .run();
    
    expect(result).toBe(25);
  });

  test('Pipeline pipe() adds single stage', async () => {
    const result = await pipeline<number>(5)
      .pipe(async (data, next) => next(data * 2))
      .pipe(async (data, next) => next(data + 3))
      .run();
    
    expect(result).toBe(13);
  });

  test('Pipeline then() returns result with destination', async () => {
    const result = await pipeline<number>(10)
      .through([
        async (data, next) => next(data * 2),
      ])
      .then(data => ({ value: data }));
    
    expect(result).toEqual({ value: 20 });
  });

  test('Pipeline handles PipeStage objects', async () => {
    const stage = createPipe<number>(async (data, next) => next(data * 3));
    
    const result = await pipeline<number>(4)
      .through([stage])
      .run();
    
    expect(result).toBe(12);
  });

  test('tap helper performs action without modifying data', async () => {
    let sideEffect = 0;
    
    const result = await pipeline<number>(10)
      .through([
        tap<number>(data => { sideEffect = data; }),
        async (data, next) => next(data * 2),
      ])
      .run();
    
    expect(result).toBe(20);
    expect(sideEffect).toBe(10);
  });

  test('when helper conditionally applies handler', async () => {
    const result1 = await pipeline<number>(5)
      .through([
        when<number>(true, async (data, next) => next(data * 2)),
      ])
      .run();
    expect(result1).toBe(10);
    
    const result2 = await pipeline<number>(5)
      .through([
        when<number>(false, async (data, next) => next(data * 2)),
      ])
      .run();
    expect(result2).toBe(5);
  });

  test('when helper works with function condition', async () => {
    const result = await pipeline<number>(10)
      .through([
        when<number>((data) => data > 5, async (data, next) => next(data * 2)),
      ])
      .run();
    
    expect(result).toBe(20);
  });

  test('unless helper is inverse of when', async () => {
    const result1 = await pipeline<number>(5)
      .through([
        unless<number>(false, async (data, next) => next(data + 10)),
      ])
      .run();
    expect(result1).toBe(15);
    
    const result2 = await pipeline<number>(5)
      .through([
        unless<number>(true, async (data, next) => next(data + 10)),
      ])
      .run();
    expect(result2).toBe(5);
  });

  test('transform helper applies transformation', async () => {
    const result = await pipeline<string>('hello')
      .through([
        transform<string>(data => data.toUpperCase()),
      ])
      .run();
    
    expect(result).toBe('HELLO');
  });

  test('Pipeline handles async transformations', async () => {
    const result = await pipeline<number>(1)
      .through([
        async (data, next) => {
          await new Promise(r => setTimeout(r, 10));
          return next(data + 1);
        },
        async (data, next) => {
          await new Promise(r => setTimeout(r, 10));
          return next(data + 1);
        },
      ])
      .run();
    
    expect(result).toBe(3);
  });

  test('Pipeline class instantiation works', async () => {
    class DoubleStage {
      handle(data: number, next: (data: number) => Promise<number>) {
        return next(data * 2);
      }
    }
    
    const result = await pipeline<number>(5)
      .through([DoubleStage])
      .run();
    
    expect(result).toBe(10);
  });

  test('thenReturn is alias for run', async () => {
    const result = await pipeline<number>(5)
      .pipe(async (data, next) => next(data * 2))
      .thenReturn();
    
    expect(result).toBe(10);
  });
});

// ============================================
// Summary
// ============================================

describe('Phase 5 Summary', () => {
  test('All Phase 5 modules are importable', () => {
    expect(Pipeline).toBeDefined();
    expect(pipeline).toBeDefined();
    expect(createPipe).toBeDefined();
    expect(tap).toBeDefined();
    expect(when).toBeDefined();
    expect(unless).toBeDefined();
    expect(transform).toBeDefined();
  });
});
