const gcd = (a: number, b: number): number => {
  let first = Math.abs(Math.trunc(a));
  let second = Math.abs(Math.trunc(b));
  while (second) [first, second] = [second, first % second];
  return first || 1;
};

const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function formatArchitecturalLength(valueFeet: unknown, denominator = 8) {
  if (!Number.isInteger(denominator) || denominator < 1 || denominator > 64) {
    throw new Error('Architectural fraction denominator must be between 1 and 64.');
  }

  const feetValue = numeric(valueFeet);
  const sign = feetValue < 0 ? '-' : '';
  const totalUnits = Math.round(Math.abs(feetValue) * 12 * denominator);
  const unitsPerFoot = 12 * denominator;
  const feet = Math.floor(totalUnits / unitsPerFoot);
  const remainder = totalUnits - feet * unitsPerFoot;
  const inches = Math.floor(remainder / denominator);
  const fractionUnits = remainder - inches * denominator;

  let fraction = '';
  if (fractionUnits) {
    const divisor = gcd(fractionUnits, denominator);
    fraction = ` ${fractionUnits / divisor}/${denominator / divisor}`;
  }

  return `${sign}${feet}'-${inches}${fraction}\"`;
}

export function formatTakeoffQuantityValue(value: unknown, unit: unknown, digits = 2) {
  return numeric(value).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatTakeoffMeasurement(value: unknown, unit: unknown, digits = 2) {
  const normalizedUnit = String(unit || '').toUpperCase();
  if (normalizedUnit === 'LF') return formatArchitecturalLength(value);
  return `${formatTakeoffQuantityValue(value, normalizedUnit, digits)} ${normalizedUnit}`.trim();
}
