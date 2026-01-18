import { HttpException } from './HttpException';

export class ConflictException extends HttpException {
  constructor(message: string = 'Conflict') {
    super(message, 409);
    this.code = 'CONFLICT';
  }
}
