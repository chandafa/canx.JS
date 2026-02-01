import type { Command } from '../Command';
export declare class HelpCommand implements Command {
    signature: string;
    description: string;
    handle(args: string[]): Promise<void>;
}
