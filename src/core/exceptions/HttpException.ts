import { CanxException } from './CanxException';

export class HttpException extends CanxException {
  constructor(message: string, status: number = 500) {
    super(message, status, `HTTP_${status}`);
  }
}
