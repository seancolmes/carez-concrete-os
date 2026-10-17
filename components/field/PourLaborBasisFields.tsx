'use client';
import {useState} from 'react';
import {Input,Label,Select} from '@fluentui/react-components';
type Risk={code:string;name:string;tax_year:number};
export function PourLaborBasisFields({planId,risks,unavailable}:{planId:string;risks:Risk[];unavailable:boolean}){
 const [date,setDate]=useState('');const year=Number(date.slice(0,4));
 return <><div className="grid gap-2"><Label htmlFor={`payroll-date-${planId}`}>Planned payroll tax date (employees)</Label><Input id={`payroll-date-${planId}`} type="date" name="payroll_tax_date" value={date} onChange={(_,data)=>setDate(data.value)} aria-describedby={`forecast-guidance-${planId}`}/></div>
 <div className="grid gap-2"><Label htmlFor={`risk-${planId}`}>Employee L&amp;I risk class</Label><Select id={`risk-${planId}`} name="risk_class_code" defaultValue="" disabled={unavailable||!date}><option value="">{unavailable?'Labor classes unavailable':date?'Select recorded class; owners/subcontractors leave blank':'Enter planned payroll date first'}</option>{risks.filter(risk=>risk.tax_year===year).map(risk=><option key={`${risk.tax_year}-${risk.code}`} value={risk.code}>{risk.code} — {risk.name} ({risk.tax_year})</option>)}</Select></div>
 <p id={`forecast-guidance-${planId}`} className="text-xs text-muted-foreground">Uses recorded terms for the pour date. Employee forecasts require verified rates and opening taxable wages for the planned payroll year. This estimate does not post payroll or consume wage caps; actual cost is reviewed separately.</p></>;
}
