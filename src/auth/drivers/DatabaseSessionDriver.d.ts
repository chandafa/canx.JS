/**
 * Database Session Driver
 * Stores sessions in a database table 'sessions'
 */
import { Session, SessionDriver } from '../Auth';
export declare class DatabaseSessionDriver implements SessionDriver {
    generateId(): string;
    create(userId: string | number, data: Record<string, unknown>, maxAge: number): Promise<Session>;
    get(id: string): Promise<Session | null>;
    destroy(id: string): Promise<boolean>;
    cleanup(): Promise<void>;
}
