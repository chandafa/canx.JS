import { Command } from '../Command';
export declare class DashboardCommand implements Command {
    signature: string;
    description: string;
    handle(): Promise<void>;
}
