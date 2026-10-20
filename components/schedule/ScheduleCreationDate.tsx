'use client';
import {createContext,useContext,useReducer,useState,type Dispatch,type ReactNode} from 'react';
import {Input} from '@fluentui/react-components';
import {scheduleDraftDate,type ScheduleDateAction} from '@/lib/field/scheduleDraftDate';

const ScheduleDateContext=createContext<{date:string;dispatch:Dispatch<ScheduleDateAction>}|null>(null);
export function ScheduleCreationDateProvider({companyDate,children}:{companyDate:string;children:ReactNode}){
 const [date,dispatch]=useReducer(scheduleDraftDate,companyDate);
 return <ScheduleDateContext.Provider value={{date,dispatch}}>{children}</ScheduleDateContext.Provider>;
}
export const useScheduleCreationDate=()=>useContext(ScheduleDateContext);
export function ScheduleCreationDateInput({fallbackDate}:{fallbackDate:string}){
 const context=useScheduleCreationDate(),[local,setLocal]=useState(fallbackDate);
 return <Input appearance="outline" type="date" name="schedule_date" required className="h-8" value={context?.date??local} onChange={(_,data)=>context?context.dispatch({type:'edit-date',date:data.value}):setLocal(data.value)}/>;
}
