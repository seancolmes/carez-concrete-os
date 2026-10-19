/** Keep a confirmed new ID while the server-refreshed roster is in flight. */
export function conditionSelectionAfterRefresh(selected:string|null,pendingCreated:string|null,available:readonly string[]){
  if(pendingCreated)return {selected:pendingCreated,pendingCreated:available.includes(pendingCreated)?null:pendingCreated};
  return {selected:!selected||!available.includes(selected)?available[0]??selected:selected,pendingCreated:null};
}
