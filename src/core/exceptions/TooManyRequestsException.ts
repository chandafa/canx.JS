import { HttpException } from './HttpException';

export class TooManyRequestsException extends HttpException {
  public retryAfter?: number;

  constructor(message: string = 'Too Many Requests', retryAfter?: number) {
    super(message, 429);
    this.code = 'TOO_MANY_REQUESTS';
    this.retryAfter = retryAfter;
  }
}
