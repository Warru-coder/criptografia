import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';

export interface WorkerTask {
  taskId: string;
  type: 'encrypt' | 'decrypt' | 'verify';
  inputPath: string;
  outputPath: string;
  masterKey: string;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  error?: string;
  duration?: number;
}

export interface WorkerPoolOptions {
  maxWorkers: number;
  workerScript: string;
}

export class WorkerPool {
  private workers: Map<string, Worker> = new Map();
  private taskQueue: WorkerTask[] = [];
  private maxWorkers: number;
  private workerScript: string;
  private activeCount: number = 0;

  constructor(options: WorkerPoolOptions) {
    this.maxWorkers = options.maxWorkers || Math.max(1, os.cpus().length - 1);
    this.workerScript = options.workerScript;
  }

  async submit(task: WorkerTask): Promise<WorkerResult> {
    return new Promise((resolve) => {
      if (this.activeCount < this.maxWorkers) {
        this.spawnWorker(task, resolve);
      } else {
        this.taskQueue.push(task);
        this.waitForWorker(resolve);
      }
    });
  }

  private spawnWorker(task: WorkerTask, resolve: (result: WorkerResult) => void): void {
    this.activeCount++;

    const workerPath = path.resolve(this.workerScript);
    const worker = new Worker(workerPath, {
      workerData: {
        taskId: task.taskId,
        type: task.type,
        inputPath: task.inputPath,
        outputPath: task.outputPath,
        masterKey: task.masterKey,
      },
    });

    this.workers.set(task.taskId, worker);

    const startTime = Date.now();

    worker.on('message', (message) => {
      if (message.type === 'complete') {
        this.workers.delete(task.taskId);
        this.activeCount--;
        resolve({ taskId: task.taskId, success: true, duration: Date.now() - startTime });
        this.processQueue();
      } else if (message.type === 'progress' && message.taskId === task.taskId) {
        logger.debug(`Task ${task.taskId} progress: ${message.percentage}%`);
      }
    });

    worker.on('error', (error) => {
      this.workers.delete(task.taskId);
      this.activeCount--;
      resolve({ taskId: task.taskId, success: false, error: error.message, duration: Date.now() - startTime });
      this.processQueue();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        this.workers.delete(task.taskId);
        this.activeCount--;
        resolve({ taskId: task.taskId, success: false, error: `Worker exited with code ${code}` });
        this.processQueue();
      }
    });
  }

  private waitForWorker(resolve: (result: WorkerResult) => void): void {
    const checkInterval = setInterval(() => {
      if (this.activeCount < this.maxWorkers && this.taskQueue.length > 0) {
        clearInterval(checkInterval);
        const task = this.taskQueue.shift();
        if (task) {
          this.spawnWorker(task, resolve);
        }
      }
    }, 100);
  }

  private processQueue(): void {
    while (this.activeCount < this.maxWorkers && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) {
        this.spawnWorker(task, () => {});
      }
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getQueuedCount(): number {
    return this.taskQueue.length;
  }

  async shutdown(): Promise<void> {
    for (const [id, worker] of this.workers) {
      await worker.terminate();
      logger.info(`Worker ${id} terminated`);
    }
    this.workers.clear();
    this.activeCount = 0;
  }
}
