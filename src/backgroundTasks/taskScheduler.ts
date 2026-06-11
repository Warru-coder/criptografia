import { TaskQueue, Task } from './taskQueue';
import { PauseResumeController } from './pauseResumeController';
import { logger } from '../utils/logger';

export interface ScheduleOptions {
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
}

export class TaskScheduler {
  private queue: TaskQueue;
  private controller: PauseResumeController;
  private maxRetries: number;
  private retryDelay: number;

  constructor(options?: ScheduleOptions) {
    this.queue = new TaskQueue({
      concurrency: options?.concurrency || 4,
      maxQueueSize: 10000,
    });
    this.controller = new PauseResumeController();
    this.maxRetries = options?.maxRetries || 3;
    this.retryDelay = options?.retryDelay || 1000;
  }

  schedule(task: Task): void {
    this.queue.add(task);
  }

  scheduleWithRetry(task: Task, retries?: number): void {
    const maxRetries = retries ?? this.maxRetries;
    let attempt = 0;

    const retryableTask: Task = {
      ...task,
      execute: async () => {
        while (attempt <= maxRetries) {
          try {
            await task.execute();
            return;
          } catch (error) {
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
            logger.warn(`Task ${task.id} failed (attempt ${attempt}/${maxRetries}), retrying...`);
            await new Promise((resolve) => setTimeout(resolve, this.retryDelay * attempt));
          }
        }
      },
    };

    this.queue.add(retryableTask);
  }

  pause(taskId?: string): void {
    this.queue.pause(taskId);
  }

  resume(taskId?: string): void {
    this.queue.resume(taskId);
  }

  cancel(taskId: string): boolean {
    return this.queue.cancel(taskId);
  }

  getStatus(taskId: string) {
    return this.queue.getTask(taskId);
  }

  getQueueStatus() {
    return this.queue.getStatus();
  }

  getActiveProcesses() {
    return this.controller.getAllStates();
  }

  setConcurrency(value: number): void {
    this.queue.setConcurrency(value);
  }

  getQueue(): TaskQueue {
    return this.queue;
  }

  getController(): PauseResumeController {
    return this.controller;
  }
}
