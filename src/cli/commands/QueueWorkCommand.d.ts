import type { Command } from '../Command';
export declare class QueueWorkCommand implements Command {
    signature: string;
    description: string;
    handle(args: string[], flags: Record<string, any>): Promise<void>;
}
