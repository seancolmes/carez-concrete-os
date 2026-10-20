/** Draft date continuity only; server calendar/date validation remains authoritative. */
export type ScheduleDateAction={type:'select-day'|'edit-date';date:string};
export function scheduleDraftDate(current:string,action:ScheduleDateAction){
 if(action.type==='edit-date'&&action.date==='')return '';
 return /^\d{4}-\d{2}-\d{2}$/.test(action.date)?action.date:current;
}
