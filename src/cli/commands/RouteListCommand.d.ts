import type { Command } from '../Command';
export declare class RouteListCommand implements Command {
    signature: string;
    description: string;
    handle(args: string[], flags: Record<string, any>): Promise<void>;
    private getMethodColor;
}
