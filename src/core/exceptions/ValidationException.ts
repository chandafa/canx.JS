import { CanxException } from './CanxException';

export class ValidationException extends CanxException {
  constructor(errors: Record<string, string[]>) {
    super('Validation Failed', 422, 'VALIDATION_ERROR', errors);
  }
}
