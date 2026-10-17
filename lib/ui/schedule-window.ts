/** Display windows over already-loaded schedule dates; no scheduling authority. */
export type ScheduleScale='day'|'week'|'month';
export type SchedulePeriod={key:string;label:string;start:string;end:string};
type Day={date:string;label:string};
const utc=(date:string)=>new Date(`${date}T12:00:00Z`);
const iso=(date:Date)=>date.toISOString().slice(0,10);
const addDays=(date:string,count:number)=>{const value=utc(date);value.setUTCDate(value.getUTCDate()+count);return iso(value);};
const dayLabel=(date:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(utc(date));
const sizes={day:14,week:4,month:3};

export function scheduleWindow(days:Day[],scale:ScheduleScale,page:number){
  const all:SchedulePeriod[]=[];
  for(const day of days){
    const start=scale==='day'?day.date:scale==='week'?addDays(day.date,-((utc(day.date).getUTCDay()+6)%7)):`${day.date.slice(0,7)}-01`;
    if(all.some(period=>period.start===start))continue;
    const endDate=utc(start);endDate.setUTCMonth(endDate.getUTCMonth()+1);endDate.setUTCDate(0);
    const end=scale==='day'?start:scale==='week'?addDays(start,6):iso(endDate);
    const label=scale==='day'?day.label:scale==='week'?`${dayLabel(start)} – ${dayLabel(end)}`:new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'}).format(utc(start));
    all.push({key:start,label,start,end});
  }
  const pageCount=Math.ceil(all.length/sizes[scale]);
  const index=Math.min(Math.max(0,page),Math.max(0,pageCount-1));
  const periods=all.slice(index*sizes[scale],(index+1)*sizes[scale]);
  const start=periods.length?[periods[0].start,days[0].date].sort().at(-1)!:null;
  const end=periods.length?[periods.at(-1)!.end,days.at(-1)!.date].sort()[0]:null;
  const label=start&&end?`${dayLabel(start)}${start.slice(0,4)!==end.slice(0,4)?`, ${start.slice(0,4)}`:''} – ${dayLabel(end)}, ${end.slice(0,4)}`:'No loaded dates';
  return {periods,start,end,label,index,pageCount,hasPrevious:index>0,hasNext:index+1<pageCount};
}

export function inScheduleWindow<T extends {scheduleDate:string}>(items:T[],window:{start:string|null;end:string|null}):T[]{
  return window.start&&window.end?items.filter(item=>item.scheduleDate>=window.start!&&item.scheduleDate<=window.end!):[];
}

export function staffingRisk(crewShort:number){
  return crewShort>0?`${crewShort} crew position${crewShort===1?'':'s'} unassigned.`:null;
}
