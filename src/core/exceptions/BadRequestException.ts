import { HttpException } from './HttpException';

export class BadRequestException extends HttpException {
  constructor(message: string = 'Bad Request') {
    super(message, 400);
    this.code = 'BAD_REQUEST';
  }
}
