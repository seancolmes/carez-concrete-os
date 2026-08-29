import type { DrawingGeometry } from './geometry';

export type GeometryCommandKind =
  | 'MoveVertexCommand'
  | 'MoveMeasurementCommand'
  | 'CreateCutoutCommand'
  | 'RemoveCutoutCommand';

export type GeometryMutationCommand = {
  id: string;
  kind: GeometryCommandKind;
  measurementId: string;
  before: DrawingGeometry;
  after: DrawingGeometry;
  committedAt: string;
};

export type CommandHistorySnapshot = {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: GeometryCommandKind | null;
  redoLabel: GeometryCommandKind | null;
  size: number;
};

/**
 * Tracks mutations only after the server has committed them. Undo/redo uses a
 * two-phase candidate/confirmation API so a failed persistence request never
 * advances local history away from durable state.
 */
export class GeometryCommandHistory {
  private commands: GeometryMutationCommand[] = [];
  private cursor = 0;
  private readonly limit: number;

  constructor(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Command history limit must be a positive integer.');
    this.limit = limit;
  }

  record(command: GeometryMutationCommand) {
    if (!command.id || !command.measurementId) throw new Error('A committed geometry command requires an identity.');
    this.commands.splice(this.cursor);
    this.commands.push(command);
    if (this.commands.length > this.limit) this.commands.splice(0, this.commands.length - this.limit);
    this.cursor = this.commands.length;
  }

  undoCandidate() {
    return this.cursor > 0 ? this.commands[this.cursor - 1] : null;
  }

  confirmUndo(commandId: string) {
    const candidate = this.undoCandidate();
    if (!candidate || candidate.id !== commandId) throw new Error('Undo history changed before the operation was confirmed.');
    this.cursor -= 1;
  }

  redoCandidate() {
    return this.cursor < this.commands.length ? this.commands[this.cursor] : null;
  }

  confirmRedo(commandId: string) {
    const candidate = this.redoCandidate();
    if (!candidate || candidate.id !== commandId) throw new Error('Redo history changed before the operation was confirmed.');
    this.cursor += 1;
  }

  snapshot(): CommandHistorySnapshot {
    return {
      canUndo: this.cursor > 0,
      canRedo: this.cursor < this.commands.length,
      undoLabel: this.undoCandidate()?.kind || null,
      redoLabel: this.redoCandidate()?.kind || null,
      size: this.commands.length,
    };
  }

  clear() {
    this.commands = [];
    this.cursor = 0;
  }
}
