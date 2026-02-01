import type { Command } from '../Command';
export declare class OptimizeCommand implements Command {
    signature: string;
    description: string;
    handle(): Promise<void>;
}
