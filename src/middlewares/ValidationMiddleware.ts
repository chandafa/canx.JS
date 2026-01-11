import type { MiddlewareHandler, CanxRequest } from '../types';
import { Schema } from '../schema/Schema';
import { ValidationError } from '../utils/ErrorHandler';

export function validateSchema(schema: Schema<any>, target: 'body' | 'query' | 'params' = 'body'): MiddlewareHandler {
  return async (req: CanxRequest, res, next) => {
    let data: unknown;

    if (target === 'body') {
      data = await req.body();
    } else if (target === 'query') {
      data = req.query;
    } else {
      data = req.params;
    }

    try {
      const validated = schema.parse(data);
      // Attach validated data to request for type safety in controllers
      (req as any).validatedData = validated;
      return next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: Object.fromEntries(error.errors),
          }
        });
      }
      throw error;
    }
  };
}
