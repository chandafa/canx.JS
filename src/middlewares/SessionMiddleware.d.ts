/**
 * Session Middleware
 * Automatically handles session creation, persistence, and cookie management.
 */
import { Session } from '../core/Session';
import type { CanxRequest, CanxResponse, NextFunction } from '../types';
declare module '../types' {
    interface CanxRequest {
        session: Session;
    }
}
export declare function SessionMiddleware(config?: any): (req: CanxRequest, res: CanxResponse, next: NextFunction) => Promise<void | Response>;
