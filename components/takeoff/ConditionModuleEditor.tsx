'use client';

import {Plus,Trash2} from 'lucide-react';
import {CarezNumberField} from '@/components/carez/fields';
import {Button} from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Field,FieldLabel} from '@/components/ui/field';
import {Input} from '@/components/ui/input';
import {LabeledSwitch} from '@/components/ui/labeled-switch';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {
  conditionModuleDefinition,
  conditionModuleFieldVisible,
  nextConditionModuleInstanceKey,
} from '@/lib/takeoff/conditions/moduleSchema';
import type {
  ConditionArchetypeDefinition,
  ConditionModuleConfiguration,
  ConditionModuleInputDefinition,
  ConditionModuleKey,
  ConditionScalar,
} from '@/lib/takeoff/conditions/types';

type Props={
  definition:ConditionArchetypeDefinition;
  moduleKey:ConditionModuleKey;
  modules:ConditionModuleConfiguration[];
  onChange:(modules:ConditionModuleConfiguration[])=>void;
  disabled?:boolean;
};

const titleCase=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
const switchId=(...parts:string[])=>`condition-${parts.join('-').replace(/[^a-zA-Z0-9_-]/g,'-')}`;

const PRESETS:Partial<Record<ConditionModuleKey,Array<{label:string;values:Record<string,ConditionScalar>}>>>={
  reinforcing:[
    {label:'Continuous',values:{kind:'continuous',layers:1,faces:1}},
    {label:'Transverse',values:{kind:'transverse',layers:1,faces:1}},
    {label:'Dowel / starter',values:{kind:'dowel',layers:1,faces:1}},
    {label:'Stirrup / tie',values:{kind:'stirrup',layers:1,faces:1}},
    {label:'Custom',values:{kind:'custom',layers:1,faces:1}},
  ],
  anchors_embeds:[
    {label:'Measured anchors',values:{count_mode:'measured_role'}},
    {label:'Anchors @ spacing',values:{count_mode:'spacing'}},
    {label:'Fixed count',values:{count_mode:'fixed_count'}},
  ],
  miscellaneous:[{label:'Item',values:{}}],
};

function defaultValues(fields:ConditionModuleInputDefinition[]){
  const values:Record<string,ConditionScalar>={};
  for(const field of fields){
    if(field.valueType==='boolean')values[field.key]=false;
  }
  return values;
}

export function ConditionModuleEditor({definition,moduleKey,modules,onChange,disabled=false}:Props){
  const schema=conditionModuleDefinition(definition,moduleKey);
  if(!schema)return <div className="px-3 py-4 text-xs text-muted-foreground">This module is not available for this Condition version.</div>;

  const indexes=modules
    .map((module,index)=>({module,index}))
    .filter(row=>row.module.moduleKey===moduleKey)
    .sort((a,b)=>Number(a.module.sortOrder||0)-Number(b.module.sortOrder||0));

  const update=(index:number,patch:Partial<ConditionModuleConfiguration>)=>{
    onChange(modules.map((module,current)=>current===index?{...module,...patch}:module));
  };
  const updateValue=(index:number,key:string,value:ConditionScalar)=>{
    const current=modules[index];
    const inputValues={...(current.inputValues||{}),[key]:value};
    if(moduleKey==='forms'&&key==='form_method'){
      const sideCount:Record<string,number>={earth_formed:0,one_side:1,two_sides:2};
      const derived=sideCount[String(value)];
      if(derived!==undefined)inputValues.formed_sides=derived;
    }
    const inputProvenance={
      ...(current.inputProvenance||{}),
      [key]:{mode:'project_value' as const,sourceLabel:'Condition Properties'},
    };
    if(moduleKey==='forms'&&key==='form_method'&&inputValues.formed_sides!==undefined){
      inputProvenance.formed_sides={mode:'project_value' as const,sourceLabel:'Form method'};
    }
    update(index,{inputValues,inputProvenance});
  };
  const add=(preset:Record<string,ConditionScalar>={},label?:string)=>{
    const instanceKey=nextConditionModuleInstanceKey(moduleKey,modules);
    const same=indexes.length;
    const inputValues={...defaultValues(schema.inputs),...preset};
    const inputProvenance=Object.fromEntries(Object.keys(inputValues).map(key=>[key,{mode:'project_value' as const,sourceLabel:'Condition Properties'}]));
    onChange([...modules,{
      moduleKey,
      instanceKey,
      label:label||`${schema.label} ${same+1}`,
      enabled:true,
      inputValues,
      inputProvenance,
      sortOrder:Math.max(0,...modules.map(module=>Number(module.sortOrder||0)))+10,
    }]);
  };
  const remove=(index:number)=>{
    if(modules[index]?.instanceKey==='default')return;
    onChange(modules.filter((_,current)=>current!==index));
  };

  const presets=PRESETS[moduleKey]||[];

  return <div className="space-y-2">
    {indexes.map(({module,index})=>{
      const values=module.inputValues||{};
      const visible=schema.inputs.filter(field=>conditionModuleFieldVisible(moduleKey,field,values));
      const label=module.label||schema.label;
      const switchLabel=schema.repeatable?label:'Include in Condition';
      const moduleSwitchId=switchId(moduleKey,module.instanceKey||'default','enabled');
      return <section key={`${moduleKey}:${module.instanceKey||'default'}`} className="overflow-hidden rounded-md border border-border bg-card/35">
        <header className="flex min-h-11 items-center gap-2 border-b border-border bg-muted/20 px-2.5 py-1.5">
          <LabeledSwitch
            id={moduleSwitchId}
            checked={module.enabled}
            disabled={disabled}
            onCheckedChange={checked=>update(index,{enabled:checked})}
            label={switchLabel}
            description={module.enabled?'Included in this Condition':'Excluded from this Condition'}
            className="min-h-0 flex-1 border-0 bg-transparent p-0 data-[checked=true]:border-0 data-[checked=true]:bg-transparent"
          />
          {schema.repeatable&&module.instanceKey!=='default'?<Button type="button" size="icon-sm" variant="ghost" onClick={()=>remove(index)} disabled={disabled} aria-label={`Remove ${label}`}><Trash2/></Button>:null}
        </header>
        {module.enabled?<div className="grid grid-cols-2 gap-2 p-2.5 max-[1180px]:grid-cols-1">
          {visible.map(field=>field.valueType==='boolean'
            ?<LabeledSwitch
              key={`${module.instanceKey}-${field.key}`}
              id={switchId(moduleKey,module.instanceKey||'default',field.key)}
              checked={Boolean(values[field.key])}
              disabled={disabled}
              onCheckedChange={checked=>updateValue(index,field.key,checked)}
              label={field.label}
              className="min-h-9"
            />
            :<Field key={`${module.instanceKey}-${field.key}`} className="min-w-0 gap-1">
              <FieldLabel className="text-[11px] font-semibold text-muted-foreground">{field.label}</FieldLabel>
              {field.valueType==='select'
                ?<Select value={String(values[field.key]??'')} onValueChange={value=>updateValue(index,field.key,String(value??''))} disabled={disabled}>
                  <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Select…"/></SelectTrigger>
                  <SelectContent align="start">{(field.options||[]).map(option=><SelectItem key={option} value={option}>{titleCase(option)}</SelectItem>)}</SelectContent>
                </Select>
                :field.valueType==='text'
                  ?<Input className="h-8 text-xs" value={String(values[field.key]??'')} disabled={disabled} onChange={event=>updateValue(index,field.key,event.target.value)}/>
                  :<CarezNumberField value={String(values[field.key]??'')} onChange={event=>updateValue(index,field.key,event.target.value===''?'':Number(event.target.value))} unit={field.unit} min={field.minimum} max={field.maximum} step={field.valueType==='integer'?1:'any'} disabled={disabled}/>} 
            </Field>)}
        </div>:null}
      </section>;
    })}

    {schema.repeatable?<div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={disabled}/>}> 
          <Plus/>Add {schema.label.toLowerCase()}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {(presets.length?presets:[{label:schema.label,values:{}}]).map(preset=><DropdownMenuItem key={preset.label} onClick={()=>add(preset.values,`${schema.label} ${indexes.length+1}`)}>{preset.label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>:null}
  </div>;
}
