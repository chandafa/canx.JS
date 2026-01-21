export class CanxException extends Error {
  public status: number;
  public code: string;
  public details?: any;

  public timestamp: Date;

  constructor(message: string, status: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  get statusCode(): number {
    return this.status;
  }
}
