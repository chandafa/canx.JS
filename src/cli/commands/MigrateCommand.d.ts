import type { Command } from '../Command';
export declare class MigrateCommand implements Command {
    signature: string;
    description: string;
    handle(args: string[], flags: Record<string, any>): Promise<void>;
}
