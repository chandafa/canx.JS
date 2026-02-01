import { CanxException } from "./CanxException";
export declare class ValidationException extends CanxException {
    /**
     * Validation errors as a Map for compatibility with Schema validation
     */
    readonly errors: Map<string, string[]>;
    constructor(errors: Record<string, string[]> | Map<string, string[]>);
}
