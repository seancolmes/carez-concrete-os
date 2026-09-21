export type ImperialCanonicalUnit = 'FT' | 'IN';

const finite = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number) => Number(value.toFixed(6));

export function splitImperialLength(value: string | number, canonicalUnit: ImperialCanonicalUnit) {
  const canonical = finite(value);
  const totalInches = canonicalUnit === 'FT' ? canonical * 12 : canonical;
  const sign = totalInches < 0 ? -1 : 1;
  const absolute = Math.abs(totalInches);
  const wholeFeet = Math.floor(absolute / 12);
  const inches = absolute - wholeFeet * 12;
  return {
    feet: wholeFeet * sign,
    inches: round(inches * sign),
  };
}

export function combineImperialLength(feetValue: string | number, inchesValue: string | number, canonicalUnit: ImperialCanonicalUnit) {
  const totalInches = finite(feetValue) * 12 + finite(inchesValue);
  return round(canonicalUnit === 'FT' ? totalInches / 12 : totalInches);
}
