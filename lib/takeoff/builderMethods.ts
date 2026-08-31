import { evaluateTakeoffFormula, roundTakeoff, type FormulaValue } from './formula.ts';

const installedBoardLfFormula: FormulaValue = {
  op: 'mul',
  args: [
    { var: 'quantity' },
    { var: 'form_sides' },
  ],
};

const purchaseBoardLfFormula: FormulaValue = {
  op: 'mul',
  args: [
    installedBoardLfFormula,
    {
      op: 'add',
      args: [
        { const: 1 },
        { op: 'div', args: [{ var: 'board_waste_pct' }, { const: 100 }] },
      ],
    },
  ],
};

const formContactSfcaFormula: FormulaValue = {
  op: 'mul',
  args: [
    { var: 'quantity' },
    { op: 'div', args: [{ var: 'depth_in' }, { const: 12 }] },
    { var: 'form_sides' },
  ],
};

const stakesEaFormula: FormulaValue = {
  op: 'mul',
  args: [
    {
      op: 'add',
      args: [
        {
          op: 'ceil',
          value: {
            op: 'div',
            args: [{ var: 'quantity' }, { var: 'stake_spacing_ft' }],
          },
        },
        { const: 1 },
      ],
    },
    { var: 'form_sides' },
  ],
};

export const STRIP_FOOTING_BOARD_FORM_FORMULAS = Object.freeze({
  installedBoardLf: installedBoardLfFormula,
  purchaseBoardLf: purchaseBoardLfFormula,
  formContactSfca: formContactSfcaFormula,
  stakesEa: stakesEaFormula,
});

export type StripFootingBoardFormInput = {
  lengthFt: number;
  depthIn: number;
  formedSides: number;
  stakeSpacingFt: number;
  boardWastePct?: number;
};

export type StripFootingBoardFormPreview = {
  installedBoardLf: number;
  purchaseBoardLf: number;
  formContactSfca: number;
  stakesEa: number;
};

function positive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return value;
}

export function previewStripFootingBoardForm(
  input: StripFootingBoardFormInput,
): StripFootingBoardFormPreview {
  const lengthFt = positive(input.lengthFt, 'Footing length');
  const depthIn = positive(input.depthIn, 'Footing depth');
  const formedSides = positive(input.formedSides, 'Formed sides');
  const stakeSpacingFt = positive(input.stakeSpacingFt, 'Stake spacing');
  const boardWastePct = Number(input.boardWastePct ?? 0);
  if (!Number.isFinite(boardWastePct) || boardWastePct < 0) {
    throw new Error('Board waste percent cannot be negative.');
  }

  const vars = {
    quantity: lengthFt,
    depth_in: depthIn,
    form_sides: formedSides,
    stake_spacing_ft: stakeSpacingFt,
    board_waste_pct: boardWastePct,
  };

  return {
    installedBoardLf: roundTakeoff(evaluateTakeoffFormula(installedBoardLfFormula, vars)),
    purchaseBoardLf: roundTakeoff(evaluateTakeoffFormula(purchaseBoardLfFormula, vars)),
    formContactSfca: roundTakeoff(evaluateTakeoffFormula(formContactSfcaFormula, vars)),
    stakesEa: evaluateTakeoffFormula(stakesEaFormula, vars),
  };
}
