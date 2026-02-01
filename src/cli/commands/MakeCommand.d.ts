import type { Command } from '../Command';
export declare class MakeCommand implements Command {
    signature: string;
    description: string;
    handle(args: string[], flags: Record<string, any>): Promise<void>;
}
export declare class MakeGenerator implements Command {
    signature: string;
    description: string;
    type: string;
    constructor(type: string);
    handle(args: string[], flags: Record<string, any>): Promise<void>;
    getController(name: string): string;
    getModel(name: string): string;
    getMiddleware(name: string): string;
    getMigration(name: string): string;
    getSeeder(name: string): string;
    getRequest(name: string): string;
    getResource(name: string): string;
    getPolicy(name: string): string;
    getService(name: string): string;
    getEvent(name: string): string;
    getJob(name: string): string;
    getNotification(name: string): string;
    getMail(name: string): string;
    getAction(name: string): string;
    getDto(name: string): string;
    getProvider(name: string): string;
    getCommand(name: string): string;
}
