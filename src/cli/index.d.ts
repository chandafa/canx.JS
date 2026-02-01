import type { Command } from './Command';
export type { Command };
export declare class Console {
    private commands;
    constructor();
    register(command: Command): void;
    run(args: string[]): Promise<void>;
    showHelp(): void;
}
export declare const cli: Console;
