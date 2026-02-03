import type { CanxRequest } from '../types';
import { validateAsync } from '../utils/Validator';
import { ForbiddenException } from '../core/exceptions/ForbiddenException';
import { ValidationException } from '../core/exceptions/ValidationException';

export abstract class FormRequest {
  /**
   * Determine if the user is authorized to make this request.
   */
  public authorize(req: CanxRequest): boolean | Promise<boolean> {
    return true;
  }

  /**
   * Get the validation rules that apply to the request.
   */
  abstract rules(req: CanxRequest): Record<string, string | string[]>;

  /**
   * Get custom messages for validator errors.
   */
  public messages(): Record<string, string> {
      return {};
  }

  /**
   * Helper to get input data from request
   */
  protected static async getInput(req: CanxRequest): Promise<Record<string, any>> {
    const query = req.query || {};
    let body = {};
    try {
        if (req.body) {
            body = await req.body();
        }
    } catch (e) {
        // Body might be empty or already consumed
    }
    
    // Merge: body overrides query
    return { ...query, ...body };
  }

  /**
   * Validate the request
   */
  public static async validate<T = any>(req: CanxRequest): Promise<T> {
      // 1. Instantiate the concrete class
      // @ts-ignore - this refers to the derived class
      const instance = new this();
      
      // 2. Authorize
      const authorized = await instance.authorize(req);
      if (!authorized) {
          throw new ForbiddenException('This action is unauthorized.');
      }

      // 3. Get Rules & Messages
      const rules = instance.rules(req);
      // Construct schema: Validator expects { [field]: { rules: ..., messages: ... } } or just rules
      // But based on Validator.ts: it iterates schema entries. validation schema values can be: rule list, or { rules, messages }
      // We should support merging custom messages into the schema structure or passing them separately if supported.
      // Looking at Validator.ts:
      // if (typeof rules === 'object') { ruleList = rules.rules; customMessages = rules.messages || {}; }
      
      const customMessages = instance.messages();
      const schema: Record<string, any> = {};
      
      for (const [field, rule] of Object.entries(rules)) {
          // If custom messages exist for this field, structure it
          // Naive check: does message key start with field? 
          // Validator.ts expects messages for rule names, e.g. { required: '...' }
          // If FormRequest gives { 'email.required': '...' }, we need to map it.
          // For simplicity v1: we just pass rules. 
          // To support messages, we'd need to parse `customMessages` and inject into schema.
          
          // Let's attach global custom messages if relevant, or just rely on global config.
          // If we want per-field custom messages we need to map them.
          // Let's just pass rules for now to keep it compatible with simple usage.
          
          // Advanced: Map `customMessages` to schema if needed. 
          // For now, let's assume `rules` returns simple rule definition.
          schema[field] = rule;
      }

      // 4. Validate
      const input = await this.getInput(req);
      const result = await validateAsync(input, schema);
      
      if (!result.valid) {
          // Transform Map<string, string[]> to Record<string, string[]>
          const errors: Record<string, string[]> = {};
          result.errors.forEach((msgs, field) => {
              errors[field] = msgs;
          });
          throw new ValidationException(errors);
      }
      
      return result.data as T; 
  }
}
