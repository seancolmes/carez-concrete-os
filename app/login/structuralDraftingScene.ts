export type DraftPoint = readonly [x: number, y: number];

export type StructuralDraft = {
  kind: 'slab' | 'footing' | 'rebar' | 'crosshair';
  lines: readonly (readonly DraftPoint[])[];
  label?: string;
  labelAt?: DraftPoint;
};

export type DraftFrame = {
  draft: StructuralDraft;
  progress: number;
  opacity: number;
};

export const MAX_ACTIVE_DRAFTS = 2;

const DRAW_MS = 1_350;
const HOLD_MS = 1_050;
const FADE_MS = 1_400;
const STAGGER_MS = 2_050;
const DRAFT_LIFETIME_MS = DRAW_MS + HOLD_MS + FADE_MS;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function buildStructuralDrafts(width: number, height: number): StructuralDraft[] {
  const w = Math.max(320, width);
  const h = Math.max(420, height);
  const left = w * 0.06;
  const right = w * 0.94;
  const top = h * 0.12;
  const bottom = h * 0.88;

  return [
    {
      kind: 'slab',
      lines: [[
        [left, top],
        [w * 0.49, top],
        [w * 0.49, h * 0.52],
        [left, h * 0.52],
        [left, top],
      ]],
    },
    {
      kind: 'crosshair',
      lines: [
        [[w * 0.27, top - h * 0.05], [w * 0.27, h * 0.6]],
        [[left - w * 0.02, h * 0.34], [w * 0.56, h * 0.34]],
        [[w * 0.255, h * 0.34], [w * 0.285, h * 0.34]],
        [[w * 0.27, h * 0.32], [w * 0.27, h * 0.36]],
      ],
    },
    {
      kind: 'rebar',
      lines: Array.from({ length: 8 }, (_, index) => {
        const y = top + h * (0.12 + index * 0.043);
        return [[left + w * 0.03, y], [w * 0.49, y - h * 0.035]] as const;
      }),
      label: '#4 Rebar @ 12" O.C.',
      labelAt: [left + w * 0.03, h * 0.57],
    },
    {
      kind: 'footing',
      lines: [
        [[w * 0.58, h * 0.54], [right, h * 0.5], [right - w * 0.02, bottom], [w * 0.56, bottom - h * 0.02], [w * 0.58, h * 0.54]],
        [[w * 0.62, h * 0.59], [right - w * 0.05, h * 0.56], [right - w * 0.065, bottom - h * 0.06], [w * 0.6, bottom - h * 0.07], [w * 0.62, h * 0.59]],
      ],
      label: "T.O.F. El. 102.4'",
      labelAt: [w * 0.59, h * 0.48],
    },
    {
      kind: 'crosshair',
      lines: [
        [[w * 0.73, h * 0.4], [w * 0.73, bottom + h * 0.04]],
        [[w * 0.52, h * 0.7], [right + w * 0.02, h * 0.7]],
        [[w * 0.715, h * 0.7], [w * 0.745, h * 0.7]],
        [[w * 0.73, h * 0.68], [w * 0.73, h * 0.72]],
      ],
      label: 'Grid Line B-4',
      labelAt: [w * 0.75, h * 0.68],
    },
  ];
}

export function sampleDraftFrame(drafts: readonly StructuralDraft[], elapsedMs: number): DraftFrame[] {
  if (drafts.length === 0) return [];
  const cycleMs = (drafts.length - 1) * STAGGER_MS + DRAFT_LIFETIME_MS + 600;
  const elapsed = ((elapsedMs % cycleMs) + cycleMs) % cycleMs;
  const frame: DraftFrame[] = [];

  drafts.forEach((draft, index) => {
    const local = elapsed - index * STAGGER_MS;
    if (local < 0 || local >= DRAFT_LIFETIME_MS) return;
    const progress = clamp(local / DRAW_MS);
    const opacity = local <= DRAW_MS + HOLD_MS
      ? 1
      : clamp(1 - (local - DRAW_MS - HOLD_MS) / FADE_MS);
    frame.push({ draft, progress, opacity });
  });

  return frame.slice(-MAX_ACTIVE_DRAFTS);
}
