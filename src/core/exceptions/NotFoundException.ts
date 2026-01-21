import { HttpException } from './HttpException';

export class NotFoundException extends HttpException {
  constructor(resource: string = 'Resource', id?: string | number) {
    const message = id ? `${resource} with ID ${id} not found` : resource;
    super(message, 404);
    this.code = 'NOT_FOUND';
  }
}
