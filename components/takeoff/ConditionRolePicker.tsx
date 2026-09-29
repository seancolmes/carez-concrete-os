'use client';

import {useMemo,useState} from 'react';
import {ChevronsUpDown} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';

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
  const selected=useMemo(()=>choices.find(choice=>choice.id===value)||null,[choices,value]);

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger
      render={<Button type="button" variant="outline" role="combobox" aria-label={placeholder} aria-expanded={open} disabled={disabled} className="h-6 w-full min-w-0 justify-between bg-[#121212] border border-[#25292C] hover:border-[#343A3F] text-white text-[11px] rounded-[3px] px-2 text-left font-normal focus-visible:border-[#009966] focus-visible:ring-1 focus-visible:ring-[#009966]"/>}
    >
      <span className="min-w-0 flex-1 truncate">{selected?<><span className="font-medium text-white">{selected.label}</span><span className="ml-1 text-muted-foreground">· {selected.meta}</span></>:placeholder}</span>
      <ChevronsUpDown className="ml-1 size-3.5 shrink-0 text-muted-foreground"/>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={4} className="w-(--anchor-width) min-w-72 p-0 bg-[#121212] border border-[#343A3F] text-white">
      <Command>
        <CommandInput placeholder="Find takeoff…"/>
        <CommandList>
          <CommandEmpty>No matching takeoff.</CommandEmpty>
          <CommandItem
            value={emptyLabel}
            data-checked={!value}
            onSelect={()=>{onChange('');setOpen(false);}}
          >
            <span className="text-muted-foreground">{emptyLabel}</span>
          </CommandItem>
          {choices.map(choice=><CommandItem
            key={choice.id}
            value={`${choice.label} ${choice.meta}`}
            data-checked={choice.id===value}
            onSelect={()=>{onChange(choice.id);setOpen(false);}}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-medium">{choice.label}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{choice.meta}</span>
            </span>
          </CommandItem>)}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
