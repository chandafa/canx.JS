import { HttpException } from './HttpException';

export class MethodNotAllowedException extends HttpException {
  public allowedMethods: string[];

  constructor(allowedMethods: string[] = [], message?: string) {
    super(message || `Method not allowed. Allowed: ${allowedMethods.join(', ')}`, 405);
    this.code = 'METHOD_NOT_ALLOWED';
    this.allowedMethods = allowedMethods;
  }
}
