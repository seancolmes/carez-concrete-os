import assert from 'node:assert/strict';
import test from 'node:test';
import { inferSheetMetadata, sheetDisplayLabel, type PositionedPdfText } from '../lib/takeoff/sheetMetadata.ts';

const pageWidth = 1000;
const pageHeight = 700;
const item = (text: string, x: number, y: number): PositionedPdfText => ({ text, x, y, pageWidth, pageHeight });

const infer = (...items: PositionedPdfText[]) => inferSheetMetadata(items);

test('recognizes structural sheet number and nearby title', () => {
  const result = infer(item('S100.4', 860, 55), item('FOUNDATION FRAMING PLAN', 760, 90));
  assert.equal(result.sheetNumber, 'S100.4');
  assert.equal(result.title, 'FOUNDATION FRAMING PLAN');
});

test('recognizes common architectural, general, and civil sheet numbers', () => {
  assert.deepEqual(infer(item('A101', 850, 50), item('FIRST FLOOR PLAN', 760, 85)).sheetNumber, 'A101');
  assert.deepEqual(infer(item('G001', 850, 50), item('GENERAL NOTES', 760, 85)).sheetNumber, 'G001');
  assert.deepEqual(infer(item('C1.0', 850, 50), item('CIVIL SITE PLAN', 760, 85)).sheetNumber, 'C1.0');
});

test('normalizes spaced sheet number formatting', () => {
  const result = infer(item('S 100.4', 850, 50), item('FOUNDATION PLAN', 760, 85));
  assert.equal(result.sheetNumber, 'S100.4');
});

test('title block candidate outranks distracting body references', () => {
  const result = infer(
    item('A4', 310, 430),
    item('DETAIL 7', 320, 420),
    item('S100.4', 875, 45),
    item('FOUNDATION FRAMING PLAN', 745, 78),
  );
  assert.equal(result.sheetNumber, 'S100.4');
  assert.equal(result.title, 'FOUNDATION FRAMING PLAN');
});

test('ambiguous body-only text does not invent sheet metadata', () => {
  const result = infer(item('A4', 320, 430), item('SECTION', 330, 410), item('2-6', 500, 300));
  assert.equal(result.sheetNumber, null);
  assert.equal(result.title, null);
});

test('mixed plan sets can preserve fallback labels independently', () => {
  const named = infer(item('S200.1', 860, 45), item('BUILDING SECTIONS', 750, 80));
  const unnamed = infer(item('DETAIL 5', 350, 400));
  assert.equal(sheetDisplayLabel({ page_number: 4, sheet_number: named.sheetNumber, title: named.title }), 'S200.1 — BUILDING SECTIONS');
  assert.equal(sheetDisplayLabel({ page_number: 5, sheet_number: unnamed.sheetNumber, title: unnamed.title }), 'PDF Page 5');
});

test('display hierarchy handles partial metadata', () => {
  assert.equal(sheetDisplayLabel({ page_number: 1, sheet_number: 'G001', title: null }), 'G001');
  assert.equal(sheetDisplayLabel({ page_number: 2, sheet_number: null, title: 'General Notes' }), 'General Notes');
  assert.equal(sheetDisplayLabel({ page_number: 3, sheet_number: null, title: null }), 'PDF Page 3');
});

test('inference is deterministic for the same positioned text', () => {
  const input = [item('A101', 850, 50), item('FIRST FLOOR PLAN', 760, 85), item('PROJECT 26-001', 760, 30)];
  assert.deepEqual(inferSheetMetadata(input), inferSheetMetadata(input));
});
