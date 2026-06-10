import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAppDataPath } from '../config';

export interface Checkpoint {
  operationId: string;
  type: 'encrypt' | 'decrypt';
  status: 'in_progress' | 'paused' | 'completed' | 'failed';
  files: CheckpointFile[];
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface CheckpointFile {
  inputPath: string;
  outputPath: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  bytesProcessed: number;
  totalBytes: number;
  error?: string;
}

export class CheckpointManager {
  private checkpointDir: string;

  constructor() {
    this.checkpointDir = path.join(getAppDataPath(), 'checkpoints');
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  createCheckpoint(operationId: string, type: 'encrypt' | 'decrypt', files: string[]): Checkpoint {
    const checkpoint: Checkpoint = {
      operationId,
      type,
      status: 'in_progress',
      files: files.map((f) => ({
        inputPath: f,
        outputPath: '',
        status: 'pending',
        bytesProcessed: 0,
        totalBytes: fs.existsSync(f) ? fs.statSync(f).size : 0,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveCheckpoint(checkpoint);
    return checkpoint;
  }

  updateFileProgress(operationId: string, inputPath: string, bytesProcessed: number, status: CheckpointFile['status']): void {
    const checkpoint = this.loadCheckpoint(operationId);
    if (!checkpoint) return;

    const fileEntry = checkpoint.files.find((f) => f.inputPath === inputPath);
    if (fileEntry) {
      fileEntry.bytesProcessed = bytesProcessed;
      fileEntry.status = status;
      checkpoint.updatedAt = new Date().toISOString();
      this.saveCheckpoint(checkpoint);
    }
  }

  setOutputPath(operationId: string, inputPath: string, outputPath: string): void {
    const checkpoint = this.loadCheckpoint(operationId);
    if (!checkpoint) return;

    const fileEntry = checkpoint.files.find((f) => f.inputPath === inputPath);
    if (fileEntry) {
      fileEntry.outputPath = outputPath;
      checkpoint.updatedAt = new Date().toISOString();
      this.saveCheckpoint(checkpoint);
    }
  }

  markCompleted(operationId: string): void {
    const checkpoint = this.loadCheckpoint(operationId);
    if (!checkpoint) return;

    checkpoint.status = 'completed';
    checkpoint.updatedAt = new Date().toISOString();
    this.saveCheckpoint(checkpoint);
  }

  markFailed(operationId: string, error: string): void {
    const checkpoint = this.loadCheckpoint(operationId);
    if (!checkpoint) return;

    checkpoint.status = 'failed';
    checkpoint.error = error;
    checkpoint.updatedAt = new Date().toISOString();
    this.saveCheckpoint(checkpoint);
  }

  pause(operationId: string): void {
    const checkpoint = this.loadCheckpoint(operationId);
    if (!checkpoint) return;

    checkpoint.status = 'paused';
    checkpoint.updatedAt = new Date().toISOString();
    this.saveCheckpoint(checkpoint);
  }

  resume(operationId: string): Checkpoint | null {
    const checkpoint = this.loadCheckpoint(operationId);
    if (!checkpoint) return null;

    checkpoint.status = 'in_progress';
    checkpoint.updatedAt = new Date().toISOString();
    this.saveCheckpoint(checkpoint);
    return checkpoint;
  }

  getPendingFiles(operationId: string): CheckpointFile[] {
    const checkpoint = this.loadCheckpoint(operationId);
    if (!checkpoint) return [];

    return checkpoint.files.filter((f) => f.status === 'pending' || f.status === 'failed');
  }

  deleteCheckpoint(operationId: string): void {
    const checkpointPath = this.getCheckpointPath(operationId);
    if (fs.existsSync(checkpointPath)) {
      fs.unlinkSync(checkpointPath);
    }
  }

  listCheckpoints(): Checkpoint[] {
    if (!fs.existsSync(this.checkpointDir)) return [];

    const files = fs.readdirSync(this.checkpointDir);
    const checkpoints: Checkpoint[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const data = fs.readFileSync(path.join(this.checkpointDir, file), 'utf-8');
          checkpoints.push(JSON.parse(data));
        } catch {
          // skip corrupted checkpoints
        }
      }
    }

    return checkpoints.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  private getCheckpointPath(operationId: string): string {
    const hash = crypto.createHash('sha256').update(operationId).digest('hex').slice(0, 16);
    return path.join(this.checkpointDir, `${hash}.json`);
  }

  private saveCheckpoint(checkpoint: Checkpoint): void {
    const checkpointPath = this.getCheckpointPath(checkpoint.operationId);
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  private loadCheckpoint(operationId: string): Checkpoint | null {
    const checkpointPath = this.getCheckpointPath(operationId);
    if (!fs.existsSync(checkpointPath)) return null;

    try {
      const data = fs.readFileSync(checkpointPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
