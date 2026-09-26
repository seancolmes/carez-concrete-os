export type ChangeType = 'additive' | 'deductive' | 'no_cost';
export type CostEffect = 'cost' | 'credit';

export function signedChangeOrderSell(changeType: ChangeType, amount: number): number {
  const magnitude = Math.abs(Number.isFinite(amount) ? amount : 0);
  if (changeType === 'deductive') return -magnitude;
  if (changeType === 'no_cost') return 0;
  return magnitude;
}

export function signedChangeOrderCost(costEffect: CostEffect, amount: number): number {
  const magnitude = Math.abs(Number.isFinite(amount) ? amount : 0);
  return costEffect === 'credit' ? -magnitude : magnitude;
}
