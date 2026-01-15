export interface Command {
  signature: string;
  description: string;
  handle(args: string[], flags: Record<string, any>): Promise<void>;
}
