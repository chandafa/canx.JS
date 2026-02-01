import { BaseController } from '../../mvc/Controller';
export declare class QueueController extends BaseController {
    index(): Response;
    stats(): Promise<Response>;
    failed(): Promise<Response>;
    pending(): Promise<Response>;
    retry(): Promise<Response>;
    clear(): Promise<Response>;
}
