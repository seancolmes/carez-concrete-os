'use client';

import {useMemo,useState} from 'react';
import {Combobox,Option} from '@fluentui/react-components';

type ConditionRoleChoice={
  id:string;
  label:string;
  meta:string;
};

type Props={
  value:string;
  choices:ConditionRoleChoice[];
  placeholder:string;
  emptyLabel:string;
  disabled?:boolean;
  onChange:(value:string)=>void;
};

export function ConditionRolePicker({value,choices,placeholder,emptyLabel,disabled=false,onChange}:Props){
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const selected=useMemo(()=>choices.find(choice=>choice.id===value)||null,[choices,value]);

  return <Combobox
    appearance="underline"
    size="small"
    className="w-full min-w-0"
    aria-label={placeholder}
    placeholder={selected?undefined:placeholder}
    disabled={disabled}
    open={open}
    value={open?query:selected?.label||''}
    selectedOptions={value?[value]:[]}
    onOpenChange={(_,data)=>{setOpen(data.open);if(data.open)setQuery('');}}
    onChange={event=>setQuery(event.target.value)}
    onOptionSelect={(_,data)=>{onChange(data.optionValue||'');setOpen(false);}}
  >
    <Option value="" text={emptyLabel}>{emptyLabel}</Option>
    {choices.map(choice=><Option key={choice.id} value={choice.id} text={`${choice.label} ${choice.meta}`}><span className="flex min-w-0 flex-col"><strong className="truncate text-[11px]">{choice.label}</strong><small className="truncate text-[10px]">{choice.meta}</small></span></Option>)}
  </Combobox>;
}
