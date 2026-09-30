'use client';

import {useEffect,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Input,Popover,PopoverSurface,PopoverTrigger} from '@fluentui/react-components';
import {updateGeneratedLaborAssumption} from '@/app/estimates/actions';
import {crewDaysToManHoursPerUnit,laborDirectPerSfToManHoursPerUnit,manHoursPerUnitToCrewDays,manHoursPerUnitToLaborDirectPerSf} from '@/lib/takeoff/laborConversion';

type Props={
  estimateId:string;
  outputId:string;
  productionQuantity:number;
  productionUnit:string;
  currentManHoursPerUnit:number|null;
  laborHourlyRate:number|null;
  disabled:boolean;
};

const positive=(value:string)=>value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
const nonnegative=(value:string)=>value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
const format=(value:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(value);

export function SmartLaborCell({estimateId,outputId,productionQuantity,productionUnit,currentManHoursPerUnit,laborHourlyRate,disabled}:Props){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<'rate'|'crewDays'|'laborDirectPerSf'>('rate');
  const [rateInput,setRateInput]=useState(currentManHoursPerUnit===null?'':String(currentManHoursPerUnit));
  const [priceInput,setPriceInput]=useState(currentManHoursPerUnit!==null&&laborHourlyRate!==null?String(currentManHoursPerUnit*laborHourlyRate):'');
  const [crewDaysInput,setCrewDaysInput]=useState('');
  const [crewSizeInput,setCrewSizeInput]=useState('');
  const [hoursPerDayInput,setHoursPerDayInput]=useState('');
  const [status,setStatus]=useState('');
  const [pending,startTransition]=useTransition();

  useEffect(()=>{
    setRateInput(currentManHoursPerUnit===null?'':String(currentManHoursPerUnit));
    setPriceInput(currentManHoursPerUnit!==null&&laborHourlyRate!==null?String(currentManHoursPerUnit*laborHourlyRate):'');
  },[currentManHoursPerUnit,laborHourlyRate]);

  const parsedCrewSize=positive(crewSizeInput);
  const crewSize=parsedCrewSize!==null&&Number.isInteger(parsedCrewSize)?parsedCrewSize:null;
  const hoursPerDay=positive(hoursPerDayInput);
  const crewDays=nonnegative(crewDaysInput);
  const directRate=nonnegative(rateInput);
  const priceAvailable=productionUnit==='SF'&&laborHourlyRate!==null&&Number.isFinite(laborHourlyRate)&&laborHourlyRate>0;
  const directPrice=nonnegative(priceInput);
  const priceRate=priceAvailable&&directPrice!==null?laborDirectPerSfToManHoursPerUnit(directPrice,Number(laborHourlyRate)):null;
  const derivedRate=crewDays!==null&&crewSize!==null&&hoursPerDay!==null?crewDaysToManHoursPerUnit(crewDays,crewSize,hoursPerDay,productionQuantity):null;
  const rate=mode==='crewDays'?derivedRate:mode==='laborDirectPerSf'?priceRate:directRate;
  const equivalentCrewDays=mode!=='crewDays'&&rate!==null&&crewSize!==null&&hoursPerDay!==null?manHoursPerUnitToCrewDays(rate,productionQuantity,crewSize,hoursPerDay):null;
  const laborDirectPerSf=priceAvailable&&rate!==null?manHoursPerUnitToLaborDirectPerSf(rate,Number(laborHourlyRate)):null;
  const explanation=productionQuantity<=0?'A positive production quantity is required.':mode==='crewDays'&&derivedRate===null?'Enter crew days, an integer crew size, and hours per day to calculate MH / unit.':mode==='laborDirectPerSf'&&priceRate===null?'Enter labor-direct $/SF and select a burdened labor rate to calculate MH / SF.':'';

  const save=()=>{
    if(disabled||pending||rate===null||productionQuantity<=0)return;
    const form=new FormData();
    form.set('estimate_id',estimateId);
    form.set('output_id',outputId);
    form.set('man_hours_per_unit',String(rate));
    setStatus('Saving labor assumption…');
    startTransition(async()=>{
      try{
        await updateGeneratedLaborAssumption(form);
        setStatus('Labor assumption saved.');
        setMode('rate');
        setRateInput(String(rate));
        if(priceAvailable)setPriceInput(String(manHoursPerUnitToLaborDirectPerSf(rate,Number(laborHourlyRate))??''));
        setOpen(false);
        router.refresh();
      }catch(error){setStatus(error instanceof Error?error.message:'Could not save labor assumption.');}
    });
  };

  return <div className="relative min-w-[135px] text-left font-mono text-[11px]"><Popover open={open} onOpenChange={(_event,data)=>setOpen(data.open)}>
    <PopoverTrigger disableButtonEnhancement><Button type="button" appearance="secondary" size="small" aria-label="Edit labor production assumption">
      {currentManHoursPerUnit===null?'Set rate':`${format(currentManHoursPerUnit)} MH/${productionUnit}`}
    </Button></PopoverTrigger>
    <PopoverSurface className="w-[300px] border border-border bg-popover p-3 text-popover-foreground shadow-lg">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Smart labor · {format(productionQuantity)} {productionUnit}</div>
      <label className="mb-2 block">MH / {productionUnit}<Input appearance="underline" type="number" min="0" step="any" value={mode==='rate'?rateInput:rate===null?'':String(rate)} onChange={event=>{setMode('rate');setRateInput(event.target.value);setStatus('');}} disabled={disabled||pending} className="mt-1 h-8 w-full"/></label>
      {productionUnit==='SF'&&<label className="mb-2 block">Labor direct $ / SF<Input appearance="underline" type="number" min="0" step="any" value={mode==='laborDirectPerSf'?priceInput:laborDirectPerSf===null?'':String(laborDirectPerSf)} onChange={event=>{setMode('laborDirectPerSf');setPriceInput(event.target.value);setStatus('');}} disabled={disabled||pending||!priceAvailable} className="mt-1 h-8 w-full"/>{!priceAvailable&&<span className="mt-1 block text-[10px] text-warning">Select a burdened labor rate to use $/SF.</span>}</label>}
      <div className="grid grid-cols-3 gap-2">
        <label>Crew days<Input appearance="underline" type="number" min="0" step="any" value={mode==='rate'&&equivalentCrewDays!==null?String(equivalentCrewDays):crewDaysInput} onChange={event=>{setMode('crewDays');setCrewDaysInput(event.target.value);setStatus('');}} disabled={disabled||pending} className="mt-1 h-8 w-full"/></label>
        <label>Crew size<Input appearance="underline" type="number" min="1" step="1" value={crewSizeInput} onChange={event=>{setCrewSizeInput(event.target.value);setStatus('');}} disabled={disabled||pending} className="mt-1 h-8 w-full"/></label>
        <label>Hours/day<Input appearance="underline" type="number" min="0" step="any" value={hoursPerDayInput} onChange={event=>{setHoursPerDayInput(event.target.value);setStatus('');}} disabled={disabled||pending} className="mt-1 h-8 w-full"/></label>
      </div>
      <p className="my-2 text-[10px] text-muted-foreground">{explanation||`Calculated ${rate===null?'—':format(rate)} MH/${productionUnit}${laborDirectPerSf===null?'':` · $${format(laborDirectPerSf)} labor direct/SF`}. Saved as the job MH/unit assumption.`}</p>
      <div className="flex items-center justify-end gap-2"><Button type="button" appearance="subtle" size="small" onClick={()=>setOpen(false)}>Close</Button><Button type="button" size="small" onClick={save} disabled={disabled||pending||rate===null||productionQuantity<=0}>{pending?'Saving…':'Save rate'}</Button></div>
      {status&&<p role="status" className="mt-2 text-[10px] text-foreground">{status}</p>}
    </PopoverSurface>
  </Popover>{productionUnit==='SF'&&!priceAvailable&&<span className="ml-2 text-[10px] text-warning">Labor rate hold</span>}</div>;
}
