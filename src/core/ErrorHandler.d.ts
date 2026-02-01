import { CanxException } from './exceptions/CanxException';
export declare class ErrorHandler {
    /**
     * Handle an error and return a formatted Response
     */
    static handle(error: Error | CanxException, req: Request, isDev?: boolean): Promise<Response>;
    /**
     * Log error to console with ANSI colors
     */
    private static logError;
    /**
     * Get emoji for status code
     */
    private static getStatusEmoji;
    /**
     * Render HTML Error Page
     */
    private static renderErrorPage;
    /**
     * Helper to extract code snippet from stack trace
     */
    private static getFileContext;
    /**
     * Escape HTML special characters
     */
    private static escapeHtml;
}
