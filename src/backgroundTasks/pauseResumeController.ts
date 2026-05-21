import { EventEmitter } from 'events';

export interface ProcessState {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  bytesProcessed: number;
  totalBytes: number;
  currentFile: string;
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export class PauseResumeController extends EventEmitter {
  private states: Map<string, ProcessState> = new Map();
  private pauseFlags: Map<string, boolean> = new Map();

  initializeProcess(id: string, totalBytes: number, currentFile: string): void {
    this.states.set(id, {
      id,
      status: 'running',
      bytesProcessed: 0,
      totalBytes,
      currentFile,
      startedAt: new Date(),
    });
    this.pauseFlags.set(id, false);
  }

  updateProgress(id: string, bytesProcessed: number, currentFile: string): void {
    const state = this.states.get(id);
    if (state) {
      state.bytesProcessed = bytesProcessed;
      state.currentFile = currentFile;
      this.emit('progress', state);
    }
  }

  pause(id: string): boolean {
    const state = this.states.get(id);
    if (!state || state.status !== 'running') {
      return false;
    }

    this.pauseFlags.set(id, true);
    state.status = 'paused';
    state.pausedAt = new Date();
    this.emit('paused', state);
    return true;
  }

  resume(id: string): boolean {
    const state = this.states.get(id);
    if (!state || state.status !== 'paused') {
      return false;
    }

    this.pauseFlags.set(id, false);
    state.status = 'running';
    state.pausedAt = undefined;
    this.emit('resumed', state);
    return true;
  }

  cancel(id: string): boolean {
    const state = this.states.get(id);
    if (!state) {
      return false;
    }

    this.pauseFlags.set(id, true);
    state.status = 'cancelled';
    state.completedAt = new Date();
    this.emit('cancelled', state);
    return true;
  }

  complete(id: string): void {
    const state = this.states.get(id);
    if (state) {
      state.status = 'completed';
      state.completedAt = new Date();
      state.bytesProcessed = state.totalBytes;
      this.emit('completed', state);
    }
  }

  fail(id: string, error: string): void {
    const state = this.states.get(id);
    if (state) {
      state.status = 'failed';
      state.error = error;
      state.completedAt = new Date();
      this.emit('failed', state);
    }
  }

  isPaused(id: string): boolean {
    return this.pauseFlags.get(id) || false;
  }

  async waitForResume(id: string): Promise<void> {
    while (this.isPaused(id)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  getState(id: string): ProcessState | undefined {
    return this.states.get(id);
  }

  getAllStates(): ProcessState[] {
    return Array.from(this.states.values());
  }

  clearCompleted(): void {
    for (const [id, state] of this.states) {
      if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
        this.states.delete(id);
        this.pauseFlags.delete(id);
      }
    }
  }
}
