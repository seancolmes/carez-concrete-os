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

export type GeometryHistoryScope = { companyId: string; userId: string; takeoffSetId: string };
export const geometryHistoryKey = (scope: GeometryHistoryScope) =>
  `pourtrace:geometry-history:v1:${scope.companyId}:${scope.userId}:${scope.takeoffSetId}`;

/** Matches persisted precision, excludes derived quantity/calibration metadata. */
export function canonicalGeometry(geometry: DrawingGeometry): DrawingGeometry {
  const points = (ring: DrawingGeometry['points']) => ring.map(({ x, y }) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) throw new Error('Invalid history geometry.');
    return { x: Number(x.toFixed(7)), y: Number(y.toFixed(7)) };
  });
  if (!['polyline', 'polygon', 'count'].includes(geometry.type) || !geometry.points?.length) throw new Error('Invalid history geometry.');
  return { type: geometry.type, points: points(geometry.points), ...(geometry.type === 'polygon' && geometry.holes?.length ? { holes: geometry.holes.map(points) } : {}) };
}

export const sameGeometry = (a: DrawingGeometry, b: DrawingGeometry) => JSON.stringify(canonicalGeometry(a)) === JSON.stringify(canonicalGeometry(b));

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
  private revisions: Record<string, string> = {};
  private readonly limit: number;

  constructor(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Command history limit must be a positive integer.');
    this.limit = limit;
  }

  record(command: GeometryMutationCommand, revision?: string) {
    if (!command.id || !command.measurementId) throw new Error('A committed geometry command requires an identity.');
    this.commands.splice(this.cursor);
    this.commands.push({ ...command, before: canonicalGeometry(command.before), after: canonicalGeometry(command.after) });
    if (revision) this.revisions[command.measurementId] = revision;
    if (this.commands.length > this.limit) this.commands.splice(0, this.commands.length - this.limit);
    this.cursor = this.commands.length;
  }

  revision(measurementId: string) { return this.revisions[measurementId]; }
  setRevision(measurementId: string, revision: string) { this.revisions[measurementId] = revision; }

  serialize(scope: GeometryHistoryScope) {
    const ids = new Set(this.commands.map(command => command.measurementId));
    return JSON.stringify({ version: 1, scope, commands: this.commands, cursor: this.cursor,
      revisions: Object.fromEntries(Object.entries(this.revisions).filter(([id]) => ids.has(id))) });
  }

  restore(serialized: string, scope: GeometryHistoryScope, current: { id: string; geometry: DrawingGeometry; updated_at: string }[]) {
    const parsed = JSON.parse(serialized);
    if (parsed.version !== 1 || JSON.stringify(parsed.scope) !== JSON.stringify(scope) || !Array.isArray(parsed.commands)
      || parsed.commands.length > this.limit || !Number.isInteger(parsed.cursor) || parsed.cursor < 0 || parsed.cursor > parsed.commands.length) throw new Error('History is unavailable for this workspace.');
    const kinds = new Set(['MoveVertexCommand', 'MoveMeasurementCommand', 'CreateCutoutCommand', 'RemoveCutoutCommand']);
    const commands: GeometryMutationCommand[] = parsed.commands.map((command: GeometryMutationCommand) => {
      if (!command.id || !command.measurementId || !kinds.has(command.kind) || !Number.isFinite(Date.parse(command.committedAt))) throw new Error('Invalid saved history.');
      return { ...command, before: canonicalGeometry(command.before), after: canonicalGeometry(command.after) };
    });
    const expected = new Map<string, DrawingGeometry>();
    // The first command gives the initial state; applied commands advance it.
    commands.forEach(command => { if (!expected.has(command.measurementId)) expected.set(command.measurementId, command.before); });
    commands.slice(0, parsed.cursor).forEach(command => expected.set(command.measurementId, command.after));
    for (const [id, geometry] of expected) {
      const row = current.find(item => item.id === id);
      if (!row || !sameGeometry(row.geometry, geometry) || row.updated_at !== parsed.revisions?.[id]) throw new Error('Saved history conflicts with current drawing data. History was retired; saved work is unchanged.');
    }
    this.commands = commands; this.cursor = parsed.cursor; this.revisions = { ...parsed.revisions };
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
    this.revisions = {};
  }
}
