import { HttpException } from './HttpException';

export class ServiceUnavailableException extends HttpException {
  public retryAfter?: number;

  constructor(message: string = 'Service Unavailable', retryAfter?: number) {
    super(message, 503);
    this.code = 'SERVICE_UNAVAILABLE';
    this.retryAfter = retryAfter;
  }
}
