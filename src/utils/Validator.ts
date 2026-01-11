/**
 * CanxJS Validator - Request validation with schema support
 */

import type { ValidationRule, ValidationSchema, ValidationResult } from '../types';

const validators: Record<string, (value: unknown, param?: string) => boolean> = {
  required: (v) => v !== undefined && v !== null && v !== '',
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && !isNaN(v),
  boolean: (v) => typeof v === 'boolean',
  email: (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  url: (v) => { try { new URL(String(v)); return true; } catch { return false; } },
  uuid: (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  date: (v) => !isNaN(Date.parse(String(v))),
  array: (v) => Array.isArray(v),
  object: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
};

const paramValidators: Record<string, (value: unknown, param: string) => boolean> = {
  min: (v, p) => (typeof v === 'number' ? v >= Number(p) : String(v).length >= Number(p)),
  max: (v, p) => (typeof v === 'number' ? v <= Number(p) : String(v).length <= Number(p)),
  length: (v, p) => String(v).length === Number(p),
  regex: (v, p) => new RegExp(p).test(String(v)),
  in: (v, p) => p.split(',').includes(String(v)),
  notIn: (v, p) => !p.split(',').includes(String(v)),
};

const defaultMessages: Record<string, string> = {
  required: 'Field {field} is required',
  string: 'Field {field} must be a string',
  number: 'Field {field} must be a number',
  boolean: 'Field {field} must be a boolean',
  email: 'Field {field} must be a valid email',
  url: 'Field {field} must be a valid URL',
  uuid: 'Field {field} must be a valid UUID',
  date: 'Field {field} must be a valid date',
  array: 'Field {field} must be an array',
  object: 'Field {field} must be an object',
  min: 'Field {field} must be at least {param}',
  max: 'Field {field} must be at most {param}',
  length: 'Field {field} must be exactly {param} characters',
  regex: 'Field {field} format is invalid',
  in: 'Field {field} must be one of: {param}',
  notIn: 'Field {field} must not be one of: {param}',
};

function parseRule(rule: ValidationRule): { name: string; param?: string } {
  const [name, param] = rule.split(':');
  return { name, param };
}

export function validate(data: Record<string, unknown>, schema: ValidationSchema): ValidationResult {
  const errors = new Map<string, string[]>();
  const validData: Record<string, unknown> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const fieldErrors: string[] = [];
    
    let ruleList: ValidationRule[];
    let customMessages: Record<string, string> = {};

    if (Array.isArray(rules)) {
      ruleList = rules;
    } else if (typeof rules === 'object') {
      ruleList = rules.rules;
      customMessages = rules.messages || {};
    } else {
      ruleList = [rules];
    }

    for (const rule of ruleList) {
      const { name, param } = parseRule(rule);
      
      // Skip if not required and value is empty
      if (name !== 'required' && (value === undefined || value === null || value === '')) {
        continue;
      }

      let valid = false;
      if (validators[name]) {
        valid = validators[name](value);
      } else if (paramValidators[name] && param) {
        valid = paramValidators[name](value, param);
      } else if (name === 'same') {
        valid = value === data[param!];
      } else if (name === 'different') {
        valid = value !== data[param!];
      }

      if (!valid) {
        const msg = customMessages[name] || defaultMessages[name] || `Validation failed for {field}`;
        fieldErrors.push(msg.replace('{field}', field).replace('{param}', param || ''));
      }
    }

    if (fieldErrors.length > 0) {
      errors.set(field, fieldErrors);
    } else if (value !== undefined) {
      validData[field] = value;
    }
  }

  return { valid: errors.size === 0, errors, data: validData };
}

export function validateAsync(data: Record<string, unknown>, schema: ValidationSchema): Promise<ValidationResult> {
  return Promise.resolve(validate(data, schema));
}

// Quick validators
export const is = {
  email: (v: string) => validators.email(v),
  url: (v: string) => validators.url(v),
  uuid: (v: string) => validators.uuid(v),
  date: (v: string) => validators.date(v),
  number: (v: unknown) => validators.number(v),
  string: (v: unknown) => validators.string(v),
  array: (v: unknown) => validators.array(v),
  object: (v: unknown) => validators.object(v),
};

export default { validate, validateAsync, is };
