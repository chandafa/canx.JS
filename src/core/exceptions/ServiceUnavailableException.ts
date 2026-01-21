import { HttpException } from './HttpException';

export class ServiceUnavailableException extends HttpException {
  public retryAfter?: number;

  constructor(service: string = 'Service Unavailable', message?: string) {
    const fullMessage = message ? `${service}: ${message}` : service;
    super(fullMessage, 503);
    this.code = 'SERVICE_UNAVAILABLE';
  }
}
