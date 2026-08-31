import assert from 'node:assert/strict';
import test from 'node:test';
import { previewStripFootingBoardForm } from '../lib/takeoff/builderMethods.ts';

test('strip footing board form counts physical resources instead of a material allowance', () => {
  assert.deepEqual(
    previewStripFootingBoardForm({
      lengthFt: 100,
      depthIn: 10,
      formedSides: 2,
      stakeSpacingFt: 4,
      boardWastePct: 5,
    }),
    {
      installedBoardLf: 200,
      purchaseBoardLf: 210,
      formContactSfca: 166.6667,
      stakesEa: 52,
    },
  );
});

test('stake count uses a stake at each end and a maximum spacing per formed side', () => {
  const result = previewStripFootingBoardForm({
    lengthFt: 7.6042,
    depthIn: 10,
    formedSides: 2,
    stakeSpacingFt: 4,
  });

  assert.equal(result.installedBoardLf, 15.2084);
  assert.equal(result.stakesEa, 6);
});

test('builder resource preview rejects invalid spacing and negative waste', () => {
  assert.throws(
    () => previewStripFootingBoardForm({ lengthFt: 10, depthIn: 10, formedSides: 2, stakeSpacingFt: 0 }),
    /Stake spacing must be greater than zero/,
  );
  assert.throws(
    () => previewStripFootingBoardForm({ lengthFt: 10, depthIn: 10, formedSides: 2, stakeSpacingFt: 4, boardWastePct: -1 }),
    /Board waste percent cannot be negative/,
  );
});
