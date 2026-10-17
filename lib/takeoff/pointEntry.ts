import type { NormalizedPoint } from './geometry';

/** Page-coordinate entry is an alternative to pointer input, never a quantity source. */
export function pointFromPagePercent(x: string, y: string): NormalizedPoint {
  const values = [x, y].map(value => value.trim());
  const numbers = values.map(Number);
  if (values.some(value => value === '') || numbers.some(value => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new Error('Enter X and Y between 0 and 100 percent of the page.');
  }
  return { x: numbers[0] / 100, y: numbers[1] / 100 };
}
