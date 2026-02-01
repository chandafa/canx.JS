import type { Command } from '../Command';
export declare class ScheduleRunCommand implements Command {
    signature: string;
    description: string;
    handle(): Promise<void>;
}
