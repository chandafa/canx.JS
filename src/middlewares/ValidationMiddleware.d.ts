import type { MiddlewareHandler } from '../types';
import { Schema } from '../schema/Schema';
export declare function validateSchema(schema: Schema<any>, target?: 'body' | 'query' | 'params'): MiddlewareHandler;
