import { CanxException } from "./CanxException";

export class ValidationException extends CanxException {
  /**
   * Validation errors as a Map for compatibility with Schema validation
   */
  public readonly errors: Map<string, string[]>;

  constructor(errors: Record<string, string[]> | Map<string, string[]>) {
    const errorRecord =
      errors instanceof Map ? Object.fromEntries(errors) : errors;
    super("Validation Failed", 422, "VALIDATION_ERROR", errorRecord);
    this.errors =
      errors instanceof Map ? errors : new Map(Object.entries(errors));
  }
}
