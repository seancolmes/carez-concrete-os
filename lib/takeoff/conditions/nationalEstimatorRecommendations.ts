/** 2026 National Construction Estimator, Concrete, printed p. 351 (PDF p. 39).
 * Ready-Mix Concrete and Placing excludes forms, finishing, and reinforcing.
 * These are labor factors (man-hours per cubic yard), not equipment rates.
 */
export const FOOTING_PLACEMENT_MH_PER_CY = {
  direct_chute: {factor: 0.564, label: 'Direct chute'},
  line_pump: {factor: 0.125, label: 'Trailer pump, 30 CY/hour'},
  buggy: {factor: 0.701, label: 'Buggy'},
} as const;

export function footingPlacementRecommendation(method: string) {
  return FOOTING_PLACEMENT_MH_PER_CY[method as keyof typeof FOOTING_PLACEMENT_MH_PER_CY] || null;
}
