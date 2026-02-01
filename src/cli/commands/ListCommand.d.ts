import type { Command } from '../Command';
export declare class ListCommand implements Command {
    signature: string;
    description: string;
    handle(): Promise<void>;
}
