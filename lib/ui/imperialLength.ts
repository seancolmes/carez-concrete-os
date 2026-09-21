export type ImperialCanonicalUnit = 'FT' | 'IN';

const finite = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCanonical = (value: number) => Number(value.toFixed(6));
const roundDisplayedInches = (value: number) => Number(value.toFixed(5));

export function splitImperialLength(value: string | number, canonicalUnit: ImperialCanonicalUnit) {
  const canonical = finite(value);
  const totalInches = canonicalUnit === 'FT' ? canonical * 12 : canonical;
  const sign = totalInches < 0 ? -1 : 1;
  // Canonical FT values are stored to six decimals. Re-expanding a value such
  // as 0.083333 FT produces 0.999996 IN; normalize that storage noise before
  // splitting so the editor shows the construction dimension the user entered.
  const absolute = roundDisplayedInches(Math.abs(totalInches));
  const wholeFeet = Math.floor(absolute / 12);
  const inches = roundDisplayedInches(absolute - wholeFeet * 12);
  return {
    feet: wholeFeet * sign,
    inches: inches * sign,
  };
}

export function combineImperialLength(feetValue: string | number, inchesValue: string | number, canonicalUnit: ImperialCanonicalUnit) {
  const totalInches = finite(feetValue) * 12 + finite(inchesValue);
  return roundCanonical(canonicalUnit === 'FT' ? totalInches / 12 : totalInches);
}
