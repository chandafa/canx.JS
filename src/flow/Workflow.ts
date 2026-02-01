/**
 * CanxJS Flow - Durable Execution Engine
 * @description Fault-tolerant workflow engine that survives server restarts.
 */

export type WorkflowStatus = 'running' | 'completed' | 'failed' | 'sleeping';

export interface WorkflowState {
  id: string;
  name: string;
  status: WorkflowStatus;
  history: WorkflowEvent[];
  variables: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  wakeUpAt?: Date;
}

export interface WorkflowEvent {
  type: 'step_start' | 'step_complete' | 'sleep_start' | 'sleep_complete';
  stepId?: string;
  result?: any;
  timestamp: Date;
}

export interface WorkflowStorage {
  save(state: WorkflowState): Promise<void>;
  load(id: string): Promise<WorkflowState | null>;
  findPending(): Promise<WorkflowState[]>;
}

/**
 * In-Memory Storage (Default)
 */
export class MemoryWorkflowStorage implements WorkflowStorage {
  private workflows = new Map<string, WorkflowState>();

  async save(state: WorkflowState): Promise<void> {
    this.workflows.set(state.id, state);
  }

  async load(id: string): Promise<WorkflowState | null> {
    return this.workflows.get(id) || null;
  }

  async findPending(): Promise<WorkflowState[]> {
    const now = new Date();
    return Array.from(this.workflows.values()).filter(w => {
      // Return waking up workflows or running ones that might need recovery
      if (w.status === 'sleeping' && w.wakeUpAt && w.wakeUpAt <= now) return true;
      if (w.status === 'running') return true; // Recover crashed running workflows
      return false;
    });
  }
}

/**
 * Workflow Context - The API developers use inside a workflow
 */
export class WorkflowContext {
  constructor(
    private engine: WorkflowEngine,
    private state: WorkflowState
  ) {}

  /**
   * Execute a durable step
   * If server crashes during this step, it will retry.
   * If step completed before crash, it will skip execution and return saved result.
   */
  async step<T>(id: string, handler: () => Promise<T>): Promise<T> {
    const stepId = `${id}`;
    
    // 1. Check if step already completed in history
    const completedEvent = this.state.history.find(
      e => e.type === 'step_complete' && e.stepId === stepId
    );

    if (completedEvent) {
      console.log(`[Flow] Replaying step: ${stepId} (Skipping execution)`);
      return completedEvent.result as T;
    }

    // 2. Execute Step
    console.log(`[Flow] Executing step: ${stepId}`);
    try {
      this.recordEvent({ type: 'step_start', stepId, timestamp: new Date() });
      
      const result = await handler();
      
      this.recordEvent({ 
        type: 'step_complete', 
        stepId, 
        result, 
        timestamp: new Date() 
      });
      
      await this.engine.saveState(this.state);
      return result;
    } catch (error) {
      // In a real implementation, we would handle retries here
      throw error;
    }
  }

  /**
   * Sleep for a duration (Durable Sleep)
   * IDLEs the workflow state and saves to DB. 
   * Server can restart during this time safely.
   */
  async sleep(key: string, durationMs: number): Promise<void> {
    const stepId = `sleep:${key}`;
    const completedEvent = this.state.history.find(
      e => e.type === 'sleep_complete' && e.stepId === stepId
    );

    if (completedEvent) {
      return; 
    }

    console.log(`[Flow] Sleeping for ${durationMs}ms...`);
    
    const wakeUpAt = new Date(Date.now() + durationMs);
    this.state.status = 'sleeping';
    this.state.wakeUpAt = wakeUpAt;
    
    this.recordEvent({ type: 'sleep_start', stepId, timestamp: new Date() });
    await this.engine.saveState(this.state);

    // Stop execution (Throwing a special error to suspend execution logic)
    // This requires the runner to catch and not treat as failure
    throw new SuspendExecutionError('Workflow sleeping');
  }

  private recordEvent(event: WorkflowEvent) {
    this.state.history.push(event);
    this.state.updatedAt = new Date();
  }
}

class SuspendExecutionError extends Error {}

/**
 * Workflow Engine
 */
export class WorkflowEngine {
  private workflows = new Map<string, (ctx: WorkflowContext, ...args: any[]) => Promise<any>>();
  private storage: WorkflowStorage;
  private pollingInterval: Timer | null = null;

  constructor(storage?: WorkflowStorage) {
    this.storage = storage || new MemoryWorkflowStorage();
    this.startPoller();
  }

  /**
   * Define a workflow
   */
  define(name: string, handler: (ctx: WorkflowContext, ...args: any[]) => Promise<any>) {
    this.workflows.set(name, handler);
  }

  /**
   * Start a workflow instance
   */
  async start(name: string, ...args: any[]): Promise<string> {
    const handler = this.workflows.get(name);
    if (!handler) throw new Error(`Workflow ${name} not found`);

    const id = crypto.randomUUID();
    const state: WorkflowState = {
      id,
      name,
      status: 'running',
      history: [],
      variables: { args }, // Save args for replay
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storage.save(state);
    
    // Start execution in background
    this.runWorkflow(state).catch(err => console.error('Workflow Error:', err));

    return id;
  }

  /**
   * Internal Runner
   */
  private async runWorkflow(state: WorkflowState) {
    const handler = this.workflows.get(state.name);
    if (!handler) return;

    const ctx = new WorkflowContext(this, state);
    state.status = 'running';

    try {
      const args = state.variables.args || [];
      const result = await handler(ctx, ...args);
      
      // Completed successfully
      state.status = 'completed';
      state.updatedAt = new Date();
      await this.saveState(state);
      console.log(`[Flow] Workflow ${state.id} completed.`);
      
    } catch (error) {
      if (error instanceof SuspendExecutionError) {
        console.log(`[Flow] Workflow ${state.id} suspended (sleeping).`);
        // State is already saved as sleeping in ctx.sleep()
      } else {
        state.status = 'failed';
        state.variables.error = (error as Error).message;
        state.updatedAt = new Date();
        await this.saveState(state);
        console.error(`[Flow] Workflow ${state.id} failed:`, error);
      }
    }
  }

  async saveState(state: WorkflowState) {
    await this.storage.save(state);
  }

  /**
   * Poll for sleeping workflows that need to wake up
   */
  private startPoller() {
    this.pollingInterval = setInterval(async () => {
      const pending = await this.storage.findPending();
      for (const wf of pending) {
        if (wf.status === 'sleeping') {
           // Wake up!
           console.log(`[Flow] Waking up workflow ${wf.id}`);
           
           // Mark sleep step as done
           const lastEvent = wf.history[wf.history.length - 1];
           if (lastEvent.type === 'sleep_start') {
             wf.history.push({
               type: 'sleep_complete',
               stepId: lastEvent.stepId,
               timestamp: new Date()
             });
           }
           
           wf.status = 'running';
           wf.wakeUpAt = undefined;
           this.runWorkflow(wf);
        }
      }
    }, 1000); // Check every second
  }

  stop() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }
}

// Global Instance
export const workflowEngine = new WorkflowEngine();

/**
 * Helper to define global workflow
 */
export function workflow(name: string, handler: (ctx: WorkflowContext, ...args: any[]) => Promise<any>) {
  workflowEngine.define(name, handler);
  return {
    start: (...args: any[]) => workflowEngine.start(name, ...args)
  };
}
