export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  priority: number;
  execute: () => Promise<void>;
  onProgress?: (progress: number) => void;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress: number;
}

export interface TaskQueueOptions {
  concurrency: number;
  maxQueueSize: number;
}

export class TaskQueue {
  private queue: Task[] = [];
  private running: Map<string, Task> = new Map();
  private completed: Map<string, Task> = new Map();
  private concurrency: number;
  private maxQueueSize: number;
  private paused: boolean = false;

  constructor(options?: TaskQueueOptions) {
    this.concurrency = options?.concurrency || 4;
    this.maxQueueSize = options?.maxQueueSize || 10000;
  }

  async add(task: Task): Promise<void> {
    if (this.queue.length + this.running.size >= this.maxQueueSize) {
      throw new Error('Task queue is full');
    }

    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority);

    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.running.size < this.concurrency && !this.paused) {
      const task = this.queue.shift();
      if (!task) break;

      this.running.set(task.id, task);
      task.status = 'running';
      task.startedAt = new Date();

      this.executeTask(task);
    }
  }

  private async executeTask(task: Task): Promise<void> {
    try {
      await task.execute();
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = new Date();
    } catch (error) {
      task.status = 'failed';
      task.error = (error as Error).message;
      task.completedAt = new Date();
    } finally {
      this.running.delete(task.id);
      this.completed.set(task.id, task);
      await this.processQueue();
    }
  }

  pause(taskId?: string): void {
    if (taskId) {
      const task = this.running.get(taskId);
      if (task) {
        task.status = 'paused';
      }
    } else {
      this.paused = true;
      for (const task of this.running.values()) {
        task.status = 'paused';
      }
    }
  }

  resume(taskId?: string): void {
    if (taskId) {
      const task = this.running.get(taskId);
      if (task && task.status === 'paused') {
        task.status = 'running';
        this.executeTask(task);
      }
    } else {
      this.paused = false;
      for (const task of this.running.values()) {
        if (task.status === 'paused') {
          task.status = 'running';
        }
      }
      this.processQueue();
    }
  }

  cancel(taskId: string): boolean {
    const queueIndex = this.queue.findIndex((t) => t.id === taskId);
    if (queueIndex !== -1) {
      this.queue[queueIndex].status = 'cancelled';
      this.queue.splice(queueIndex, 1);
      return true;
    }

    const runningTask = this.running.get(taskId);
    if (runningTask) {
      runningTask.status = 'cancelled';
      this.running.delete(taskId);
      return true;
    }

    return false;
  }

  getTask(taskId: string): Task | undefined {
    return this.queue.find((t) => t.id === taskId) || this.running.get(taskId) || this.completed.get(taskId);
  }

  getStatus(): { queued: number; running: number; completed: number; paused: boolean } {
    return {
      queued: this.queue.length,
      running: this.running.size,
      completed: this.completed.size,
      paused: this.paused,
    };
  }

  getActiveTasks(): Task[] {
    return Array.from(this.running.values());
  }

  setConcurrency(value: number): void {
    this.concurrency = Math.max(1, value);
    if (!this.paused) {
      this.processQueue();
    }
  }
}
