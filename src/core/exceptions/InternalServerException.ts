import { HttpException } from './HttpException';

export class InternalServerException extends HttpException {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500);
    this.code = 'INTERNAL_SERVER_ERROR';
  }
}
