import { HttpException } from './HttpException';

export class ConflictException extends HttpException {
  constructor(message: string = 'Conflict', resource?: string) {
    const fullMessage = resource ? `${resource}: ${message}` : message;
    super(fullMessage, 409);
    this.code = 'CONFLICT';
  }
}
