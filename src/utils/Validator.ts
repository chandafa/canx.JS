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
  // Numeric: a number or a numeric string
  numeric: (v) => (typeof v === 'number' && !isNaN(v)) || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))),
  // Integer: whole number (or whole-number string)
  integer: (v) => Number.isInteger(typeof v === 'string' ? Number(v) : v),
  // Alphabetic characters only
  alpha: (v) => typeof v === 'string' && /^[a-zA-Z]+$/.test(v),
  // Alphanumeric characters only
  alphaNum: (v) => typeof v === 'string' && /^[a-zA-Z0-9]+$/.test(v),
  alphanum: (v) => typeof v === 'string' && /^[a-zA-Z0-9]+$/.test(v),
  alpha_num: (v) => typeof v === 'string' && /^[a-zA-Z0-9]+$/.test(v),
};

// Rules that are modifiers / flow-control and never fail on their own.
// (Presence/optional semantics are handled by the empty-skip logic in validate.)
const NOOP_RULES = new Set(['nullable', 'sometimes', 'optional', 'filled', 'present', 'bail']);

// "Sizeable" measure of a value: numeric value when the field is numeric,
// otherwise string length (Laravel semantics).
function sizeOf(v: unknown, numeric: boolean): number {
  if (Array.isArray(v)) return v.length;
  if (numeric || typeof v === 'number') return Number(v);
  return String(v).length;
}

// Param validators that need the numeric context of the field.
const contextParamValidators: Record<string, (value: unknown, param: string, numeric: boolean) => boolean> = {
  min: (v, p, n) => sizeOf(v, n) >= Number(p),
  max: (v, p, n) => sizeOf(v, n) <= Number(p),
  size: (v, p, n) => sizeOf(v, n) === Number(p),
  gt: (v, p, n) => sizeOf(v, n) > Number(p),
  gte: (v, p, n) => sizeOf(v, n) >= Number(p),
  lt: (v, p, n) => sizeOf(v, n) < Number(p),
  lte: (v, p, n) => sizeOf(v, n) <= Number(p),
  between: (v, p, n) => {
    const [lo, hi] = p.split(',').map(Number);
    const s = sizeOf(v, n);
    return s >= lo && s <= hi;
  },
};

const paramValidators: Record<string, (value: unknown, param: string) => boolean> = {
  length: (v, p) => String(v).length === Number(p),
  digits: (v, p) => /^\d+$/.test(String(v)) && String(v).length === Number(p),
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
  numeric: 'Field {field} must be numeric',
  integer: 'Field {field} must be an integer',
  size: 'Field {field} must be {param}',
  gt: 'Field {field} must be greater than {param}',
  gte: 'Field {field} must be at least {param}',
  lt: 'Field {field} must be less than {param}',
  lte: 'Field {field} must be at most {param}',
  between: 'Field {field} must be between {param}',
  digits: 'Field {field} must be {param} digits',
  alpha: 'Field {field} may only contain letters',
  alphaNum: 'Field {field} may only contain letters and numbers',
  alphanum: 'Field {field} may only contain letters and numbers',
  alpha_num: 'Field {field} may only contain letters and numbers',
  confirmed: 'Field {field} confirmation does not match',
};

function parseRule(rule: ValidationRule): { name: string; param?: string } {
  // Split on the FIRST colon only, so params containing ':' (e.g. regex
  // patterns, time formats) are preserved intact.
  const idx = rule.indexOf(':');
  if (idx === -1) return { name: rule };
  return { name: rule.slice(0, idx), param: rule.slice(idx + 1) };
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
      ruleList = rules.split('|') as ValidationRule[];
    }

    // A field is "numeric" (for min/max/size/between) when it carries a
    // numeric/integer rule — matches Laravel's type inference.
    const numericField = ruleList.some((r) => {
      const n = parseRule(r).name;
      return n === 'numeric' || n === 'integer';
    });

    for (const rule of ruleList) {
      const { name, param } = parseRule(rule);

      // Modifier / flow-control rules never fail on their own.
      if (NOOP_RULES.has(name)) {
        continue;
      }

      // Skip if not required and value is empty
      if (name !== 'required' && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Skip async rules
      if (['unique', 'exists'].includes(name)) {
        continue;
      }

      let valid = false;
      if (validators[name]) {
        valid = validators[name](value);
      } else if (contextParamValidators[name] && param !== undefined) {
        valid = contextParamValidators[name](value, param, numericField);
      } else if (paramValidators[name] && param !== undefined) {
        valid = paramValidators[name](value, param);
      } else if (name === 'same') {
        valid = value === data[param!];
      } else if (name === 'different') {
        valid = value !== data[param!];
      } else if (name === 'confirmed') {
        // Laravel-style: matches `<field>_confirmation`
        valid = value === data[`${field}_confirmation`];
      } else {
        // Unknown rule name: don't hard-fail a valid value on a rule we don't
        // implement — treat as a pass (Laravel would throw, but silently
        // failing every value is worse for a forgiving framework).
        valid = true;
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

import { query } from '../mvc/Model';

type AsyncValidatorFn = (value: unknown, param?: string) => Promise<boolean>;

const asyncValidators: Record<string, AsyncValidatorFn> = {
  unique: async (v, p) => {
    if (!p) return false;
    const parts = p.split(',').map(s => s.trim());
    const table = parts[0];
    const column = parts[1];
    const exceptId = parts[2];
    const idColumn = parts[3] || 'id';
    
    // Security: Validate identifiers to prevent SQL Injection
    const identifierRegex = /^[a-zA-Z0-9_]+$/;
    if (!identifierRegex.test(table)) throw new Error(`Invalid table name in validation rule: ${table}`);
    if (!identifierRegex.test(column)) throw new Error(`Invalid column name in validation rule: ${column}`);
    if (idColumn && !identifierRegex.test(idColumn)) throw new Error(`Invalid id column in validation rule: ${idColumn}`);

    let sql = `SELECT COUNT(*) as count FROM ${table} WHERE ${column} = ?`;
    const params: any[] = [v];
    
    if (exceptId) {
      sql += ` AND ${idColumn} != ?`; // idColumn is validated above
      params.push(exceptId);
    }
    
    try {
      const rows = await query<{count: number}>(sql, params);
      return (rows[0]?.count || 0) === 0;
    } catch (e) {
      console.error('[Validator] Database error in unique:', e);
      return false;
    }
  },
  
  exists: async (v, p) => {
    if (!p) return false;
    const parts = p.split(',').map(s => s.trim());
    const table = parts[0];
    const column = parts[1] || 'id';
    
    // Security: Validate identifiers
    const identifierRegex = /^[a-zA-Z0-9_]+$/;
    if (!identifierRegex.test(table)) throw new Error(`Invalid table name in validation rule: ${table}`);
    if (!identifierRegex.test(column)) throw new Error(`Invalid column name in validation rule: ${column}`);
    
    const sql = `SELECT COUNT(*) as count FROM ${table} WHERE ${column} = ?`;
    
    try {
      const rows = await query<{count: number}>(sql, [v]);
      return (rows[0]?.count || 0) > 0;
    } catch (e) {
      console.error('[Validator] Database error in exists:', e);
      return false;
    }
  },
};

const defaultAsyncMessages: Record<string, string> = {
  unique: 'Field {field} has already been taken',
  exists: 'Selected {field} is invalid',
};

export async function validateAsync(data: Record<string, unknown>, schema: ValidationSchema): Promise<ValidationResult> {
  const errors = new Map<string, string[]>();
  const validData: Record<string, unknown> = {};

  // Run sync validation first
  const syncResult = validate(data, schema);
  if (!syncResult.valid) {
    // If sync validation fails, we might still want to run async, 
    // but usually if format is wrong, checking DB is waste.
    // However, mixing errors is good.
    // Let's copy errors
    syncResult.errors.forEach((msgs, field) => errors.set(field, msgs));
  } else {
    Object.assign(validData, syncResult.data);
  }

  // Check async rules
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    // Get rules list
    let ruleList: ValidationRule[];
    let customMessages: Record<string, string> = {};

    if (Array.isArray(rules)) {
      ruleList = rules;
    } else if (typeof rules === 'object') {
      ruleList = rules.rules;
      customMessages = rules.messages || {};
    } else {
      ruleList = rules.split('|') as ValidationRule[];
    }
    
    for (const rule of ruleList) {
      const { name, param } = parseRule(rule);
      
      // We only care about async validators here
      // And we skip if value is empty/null (unless it's required, but sync validate handled required)
      if (
        !asyncValidators[name] || 
        (value === undefined || value === null || value === '')
      ) {
        continue;
      }

      // If sync validation already failed for this field, usually we skip checking DB
      if (errors.has(field)) continue;

      try {
          const valid = await asyncValidators[name](value, param);
          
          if (!valid) {
            const msg = customMessages[name] || defaultAsyncMessages[name] || defaultMessages[name] || `Validation failed for {field}`;
            const finalMsg = msg.replace('{field}', field).replace('{param}', param || '');
            
            const existing = errors.get(field) || [];
            existing.push(finalMsg);
            errors.set(field, existing);
          }
      } catch (err) {
          console.error('[Validator] Unexpected error in validateAsync', err);
      }
    }
    
    if (!errors.has(field) && value !== undefined) {
      validData[field] = value;
    }
  }

  return { valid: errors.size === 0, errors, data: validData };
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

// ============================================
// Custom Rule Extension (Laravel-like)
// ============================================

type SyncValidatorFn = (value: unknown, param?: string) => boolean;
type AsyncExtendFn = (value: unknown, param?: string) => Promise<boolean>;

/**
 * Extend the validator with a custom rule (sync)
 * @example
 * extend('phone', (value) => /^\+?[0-9]{10,15}$/.test(String(value)), 'Field {field} must be a valid phone number');
 */
export function extend(
  name: string,
  validator: SyncValidatorFn,
  message?: string
): void {
  validators[name] = validator;
  if (message) {
    defaultMessages[name] = message;
  }
}

/**
 * Extend the validator with a custom async rule
 * @example
 * extendAsync('available', async (value) => {
 *   const result = await checkAvailability(value);
 *   return result.available;
 * }, 'Field {field} is not available');
 */
export function extendAsync(
  name: string,
  validator: AsyncExtendFn,
  message?: string
): void {
  asyncValidators[name] = validator;
  if (message) {
    defaultAsyncMessages[name] = message;
  }
}

/**
 * Extend the validator with a parameterized rule
 * @example
 * extendParam('digits', (value, param) => /^\d+$/.test(String(value)) && String(value).length === Number(param), 'Field {field} must be {param} digits');
 */
export function extendParam(
  name: string,
  validator: (value: unknown, param: string) => boolean,
  message?: string
): void {
  paramValidators[name] = validator;
  if (message) {
    defaultMessages[name] = message;
  }
}

/**
 * Get all registered validators
 */
export function getValidators(): {
  sync: Record<string, SyncValidatorFn>;
  async: Record<string, AsyncExtendFn>;
  param: Record<string, (value: unknown, param: string) => boolean>;
} {
  return {
    sync: { ...validators },
    async: { ...asyncValidators },
    param: { ...paramValidators },
  };
}

/**
 * Set a custom message for an existing rule
 */
export function setMessage(rule: string, message: string): void {
  defaultMessages[rule] = message;
}

export default { validate, validateAsync, is, extend, extendAsync, extendParam, getValidators, setMessage };
