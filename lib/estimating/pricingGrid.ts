export type ConditionGroup<T> = { id: string; name: string; rows: T[] };

export function groupPricingRows<T extends { conditionId: string; conditionName: string }>(rows: T[]): ConditionGroup<T>[] {
  const groups = new Map<string, ConditionGroup<T>>();
  for (const row of rows) {
    const group = groups.get(row.conditionId) || { id: row.conditionId, name: row.conditionName, rows: [] };
    group.rows.push(row);
    groups.set(row.conditionId, group);
  }
  return [...groups.values()];
}

export function paginateConditionGroups<T>(groups: ConditionGroup<T>[], targetRowCount: number): ConditionGroup<T>[][] {
  const pages: ConditionGroup<T>[][] = [];
  let page: ConditionGroup<T>[] = [];
  let count = 0;
  for (const group of groups) {
    if (page.length && count + group.rows.length > targetRowCount) {
      pages.push(page);
      page = [];
      count = 0;
    }
    page.push(group);
    count += group.rows.length;
  }
  if (page.length) pages.push(page);
  return pages;
}
