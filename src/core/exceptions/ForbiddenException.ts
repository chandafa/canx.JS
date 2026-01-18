import { HttpException } from './HttpException';

export class ForbiddenException extends HttpException {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
    this.code = 'FORBIDDEN';
  }
}
