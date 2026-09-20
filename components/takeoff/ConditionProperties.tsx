'use client';

import {useMemo,useState,type ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Field,FieldLabel} from '@/components/ui/field';
import {Input} from '@/components/ui/input';
import {LabeledSwitch} from '@/components/ui/labeled-switch';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {CarezFeedback,CarezProvenance,CarezSaveState,CarezStatus} from '@/components/carez/state';
import {CarezNumberField} from '@/components/carez/fields';
import {ConditionModuleEditor} from './ConditionModuleEditor';
import {ConditionRolePicker} from './ConditionRolePicker';
import type {
  ConditionInputDefinition,
  ConditionInputGroup,
  ConditionModuleKey,
} from '@/lib/takeoff/conditions/types';
import type {ConditionRoleMeasurementRequest,DirtySwitchAction} from './useConditionEditor';
import styles from './ConditionProperties.module.css';

const LABELS:Record<string,string>={
  general:'Scope',
  concrete:'Concrete',
  forms:'Forms',
  rebar:'Rebar',
  labor:'Labor',
  review:'Review',
};

const CORE_MODULES=new Set(['concrete','forms','reinforcing','labor']);

type Props={
  editor:any;
  locked?:boolean;
  onStartRoleMeasurement?:(request:ConditionRoleMeasurementRequest)=>void;
  children?:ReactNode;
};

const humanize=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
const switchId=(...parts:string[])=>'condition-properties-'+parts.join('-').replace(/[^a-zA-Z0-9_-]/g,'-');

function provenanceSummary(value:any){
  if(!value||typeof value!=='object')return null;
  const parts=[
    value.sourceLabel?String(value.sourceLabel):'',
    value.mode?humanize(String(value.mode)):'',
    value.sourceId?String(value.sourceId):'',
    value.note?String(value.note):'',
  ].filter(Boolean);
  return parts.length?parts.join(' · '):null;
}

function money(value:any){
  if(value===null||value===undefined||value==='')return'—';
  const parsed=Number(value);
  if(!Number.isFinite(parsed))return String(value);
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(parsed);
}

function outputState(output:any,holds:any[]){
  if(holds.some(hold=>String(hold.output_id||'')===String(output.id)&&hold.status==='open'))return'Held';
  const status=String(output.status||'').toLowerCase();
  const pricing=String(output.pricing_status||'').toLowerCase();
  if(status==='inactive'||status.includes('not_included')||status.includes('excluded'))return'Not included';
  if(status.includes('pending')||pricing.includes('pending'))return'Pending';
  if(output.production_quantity===null||output.production_quantity===undefined)return'Unknown';
  if(pricing.includes('missing')||pricing.includes('unpriced')||pricing.includes('required'))return'Price missing';
  return status?humanize(status):'Ready';
}

/** Single governed Condition Properties surface.
 * Values are edited here, but quantity/cost calculation remains server-authoritative.
 * Provenance labels are rendered only from persisted provenance records. */
export function ConditionProperties({editor,locked=false,onStartRoleMeasurement,children}:Props){
  const {
    selectedSummary,
    selectedVersion,
    definition,
    draft,
    moduleConfigurations,
    selectedPersistedModules,
    roleSelections,
    dirty,
    saveState,
    availableTabs,
    propertyTab,
    setPropertyTab,
    pendingSwitch,
    choosePendingSwitchAction,
    updateInput,
    updateModule,
    setRole,
    roleChoices,
    startRoleMeasurement,
    saveAndRecalculate,
    upgradeContract,
    canUpgrade,
    contractVersion,
    latestContractVersion,
    persistedInputProvenance,
    selectedOutputs,
    selectedHolds,
    sections,
    primaryMeasurement,
    assignSection,
    routeIssue,
  }=editor;
  const [upgradeOpen,setUpgradeOpen]=useState(false);
  const decide=(action:DirtySwitchAction)=>void choosePendingSwitchAction(action);
  const editable=Boolean(!locked&&!saveState.pending&&selectedVersion?.status==='draft');

  const moduleKeys=useMemo<string[]>(
    ()=>Array.from(new Set<string>((moduleConfigurations||[]).map((module:any)=>String(module.moduleKey)))),
    [moduleConfigurations],
  );

  const inputProvenance=(input:ConditionInputDefinition)=>
    provenanceSummary(persistedInputProvenance?.[input.group]?.[input.key]);

  const renderInput=(input:ConditionInputDefinition)=>{
    const value=String(draft?.[input.group]?.[input.key]??'');
    const provenance=inputProvenance(input);
    const control=input.valueType==='boolean'
      ?<LabeledSwitch
        id={switchId(selectedVersion?.id||'draft',input.group,input.key)}
        checked={Boolean(draft?.[input.group]?.[input.key])}
        onCheckedChange={checked=>updateInput(input,checked?'true':'false')}
        disabled={!editable}
        label={input.label}
      />
      :<Field>
        <FieldLabel className="text-[11px] font-semibold text-muted-foreground">{input.label}</FieldLabel>
        {input.valueType==='select'
          ?<Select value={value} onValueChange={next=>updateInput(input,String(next??''))} disabled={!editable}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select…"/></SelectTrigger>
            <SelectContent align="start">{(input.options||[]).map(option=><SelectItem key={option} value={option}>{humanize(option)}</SelectItem>)}</SelectContent>
          </Select>
          :input.valueType==='text'
            ?<Input value={value} onChange={event=>updateInput(input,event.target.value)} disabled={!editable}/>
            :<CarezNumberField
              value={value}
              onChange={event=>updateInput(input,event.target.value)}
              unit={input.unit}
              min={input.minimum}
              max={input.maximum}
              step={input.valueType==='integer'?1:'any'}
              disabled={!editable}
            />}
      </Field>;
    return <div className={styles.field} key={input.group+'-'+input.key}>
      {control}
      {provenance?<CarezProvenance label="Persisted provenance" summary={provenance}/>:null}
    </div>;
  };

  const renderInputGroup=(group:ConditionInputGroup)=>{
    const inputs=(definition?.inputs||[]).filter((input:ConditionInputDefinition)=>input.group===group);
    return inputs.length?<div className={styles.fieldGrid}>{inputs.map(renderInput)}</div>:null;
  };

  const moduleEditor=(moduleKey:ConditionModuleKey)=>
    definition&&moduleKeys.includes(moduleKey)
      ?<ConditionModuleEditor
        definition={definition}
        moduleKey={moduleKey}
        modules={moduleConfigurations}
        onChange={updateModule}
        disabled={!editable}
      />
      :<div className={styles.empty}>Not included in this Condition contract.</div>;

  const persistedModuleProvenance=(selectedPersistedModules||[]).flatMap((module:any)=>
    Object.entries(module.input_provenance||{}).map(([key,value])=>({
      key:String(module.module_key)+':'+String(module.instance_key||'default')+':'+key,
      label:String(module.label||humanize(String(module.module_key)))+' · '+humanize(key),
      summary:provenanceSummary(value),
    })).filter((row:any)=>Boolean(row.summary)),
  );

  const otherModules=moduleKeys.filter((key:string)=>!CORE_MODULES.has(key));
  const currentSectionId=String(primaryMeasurement?.estimate_section_id||'__unassigned');

  return <aside className={styles.root} aria-label="Condition Properties">
    <header className={styles.header}>
      <div className={styles.identity}>
        <span>Condition Properties</span>
        <strong>{selectedSummary?.name||'No condition selected'}</strong>
        {selectedSummary&&selectedVersion
          ?<small>{selectedSummary.code} · R{selectedSummary.revision_no} · Contract v{contractVersion} · {humanize(String(selectedVersion.status||selectedSummary.version_status||''))}</small>
          :null}
      </div>
      <div className={styles.headerActions}>
        <CarezSaveState state={saveState.pending?'saving':dirty?'unsaved':'saved'}/>
        {selectedVersion&&latestContractVersion>contractVersion
          ?selectedVersion.status==='draft'
            ?<Button type="button" size="sm" variant="outline" onClick={()=>setUpgradeOpen(true)} disabled={!canUpgrade}>Upgrade to v{latestContractVersion}</Button>
            :<CarezStatus tone="neutral" label={'Contract v'+latestContractVersion+' available · new draft required'}/>
          :null}
      </div>
    </header>

    {!selectedSummary||!selectedVersion||!definition
      ?<CarezFeedback title="Select a Condition" className={styles.emptyFeedback}>Choose a Condition to review its governed properties.</CarezFeedback>
      :<>
        {saveState.message?<CarezFeedback tone="warning" title="Condition">{saveState.message}</CarezFeedback>:null}
        <Tabs value={propertyTab} onValueChange={setPropertyTab}>
          <TabsList variant="line" className={styles.tabs}>
            {availableTabs.map((tab:string)=><TabsTrigger key={tab} value={tab}>{LABELS[tab]||humanize(tab)}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        <div className={styles.scroll}>
          {propertyTab==='general'?<section className={styles.section}>
            <div className={styles.sectionHead}><h3>Scope</h3><span>Plan facts, method choices and takeoff roles</span></div>
            <div className={styles.roles}>
              {definition.roles.map((role:any)=>{
                const choices=roleChoices(role);
                return <div className={styles.role} key={role.key}>
                  <div className={styles.roleTitle}>
                    <strong>{role.label}</strong>
                    <small>{role.primary?'Primary role':'Secondary role'} · {role.unit}{role.required?' · Required':''}</small>
                  </div>
                  <ConditionRolePicker
                    value={roleSelections[role.key]||''}
                    choices={choices}
                    placeholder={'Assign '+role.label.toLowerCase()}
                    emptyLabel="Unassigned"
                    disabled={!editable}
                    onChange={value=>setRole(role.key,value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!editable}
                    onClick={()=>{
                      const request=startRoleMeasurement(role);
                      if(request)onStartRoleMeasurement?.(request);
                    }}
                  >{'Measure '+role.label}</Button>
                </div>;
              })}
            </div>
            {renderInputGroup('planFacts')}
            {renderInputGroup('methods')}
            {renderInputGroup('drawing')}
          </section>:null}

          {propertyTab==='concrete'?<section className={styles.section}>
            <div className={styles.sectionHead}><h3>Concrete</h3><span>Concrete resource and placement assumptions governed by this Condition.</span></div>
            {moduleEditor('concrete')}
          </section>:null}

          {propertyTab==='forms'?<section className={styles.section}>
            <div className={styles.sectionHead}><h3>Forms</h3><span>Form method, physical resources and repeatable configuration.</span></div>
            {moduleEditor('forms')}
          </section>:null}

          {propertyTab==='rebar'?<section className={styles.section}>
            <div className={styles.sectionHead}><h3>Rebar</h3><span>Reinforcing instances remain explicit and estimator-controlled.</span></div>
            {moduleEditor('reinforcing')}
          </section>:null}

          {propertyTab==='labor'?<section className={styles.section}>
            <div className={styles.sectionHead}><h3>Labor</h3><span>Production assumptions remain inputs; calculated labor remains server-authoritative.</span></div>
            {moduleEditor('labor')}
            {renderInputGroup('production')}
          </section>:null}

          {propertyTab==='review'?<section className={styles.section}>
            <div className={styles.sectionHead}><h3>Review</h3><span>Calculated outputs are read-only.</span></div>
            <CarezStatus tone="neutral" label="Calculated outputs are read-only"/>
            <div className={styles.explicitStates}>States remain explicit: Unknown · Pending · Held · Not included · Price missing.</div>

            {renderInputGroup('commercial')}

            {primaryMeasurement?<Field>
              <FieldLabel>Estimate section</FieldLabel>
              <Select
                value={currentSectionId}
                onValueChange={value=>void assignSection(value==='__unassigned'?null:String(value))}
                disabled={!editable}
              >
                <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned">Unassigned</SelectItem>
                  {(sections||[]).map((section:any)=><SelectItem key={section.id} value={String(section.id)}>{section.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>:null}

            {otherModules.length?<div className={styles.stack}>
              <h4>Additional Condition modules</h4>
              {otherModules.map((moduleKey:string)=><div key={moduleKey} className={styles.moduleBlock}>
                <strong>{humanize(moduleKey)}</strong>
                {moduleEditor(moduleKey)}
              </div>)}
            </div>:null}

            {selectedHolds.length?<div className={styles.stack}>
              <h4>Open issues</h4>
              {selectedHolds.map((hold:any)=><button type="button" className={styles.issue} key={hold.id} onClick={()=>routeIssue(hold)}>
                <strong>{humanize(String(hold.hold_code||'Review required'))}</strong>
                <span>{hold.message}</span>
              </button>)}
            </div>:null}

            <div className={styles.outputs}>
              {selectedOutputs.length?selectedOutputs.map((output:any)=>{
                const state=outputState(output,selectedHolds);
                return <article className={styles.output} key={output.id}>
                  <div className={styles.outputHead}><strong>{output.label}</strong><CarezStatus tone={state==='Held'||state==='Price missing'?'warning':'neutral'} label={state}/></div>
                  <CarezNumberField
                    aria-label={output.label+' calculated quantity'}
                    value={output.production_quantity===null||output.production_quantity===undefined?'':String(output.production_quantity)}
                    unit={output.production_unit}
                    kind="quantity"
                    derived
                    disabled
                  />
                  <small>Persisted Direct Cost: {money(output.direct_cost)} · Pricing: {humanize(String(output.pricing_status||'unknown'))}</small>
                </article>;
              }):<div className={styles.empty}>No calculated outputs are persisted for this Condition.</div>}
            </div>

            {persistedModuleProvenance.length?<div className={styles.stack}>
              <h4>Persisted module provenance</h4>
              {persistedModuleProvenance.map((row:any)=><CarezProvenance key={row.key} label={row.label} summary={row.summary}/>)}
            </div>:null}
          </section>:null}

          {children}
        </div>

        <footer className={styles.footer}>
          <span role="status">{dirty?'Unsaved changes':'Changes are persisted only after Save & Recalculate.'}</span>
          <Button
            type="button"
            disabled={!editable||!dirty}
            onClick={()=>void saveAndRecalculate()}
          >Save &amp; Recalculate</Button>
        </footer>
      </>}

    <Dialog open={Boolean(pendingSwitch)} onOpenChange={open=>{if(!open)decide('cancel');}}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Unsaved Condition changes</DialogTitle>
          <DialogDescription>Save this Condition before switching, or discard the current edits.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>decide('cancel')} disabled={saveState.pending}>Cancel</Button>
          <Button variant="outline" onClick={()=>decide('discard')} disabled={saveState.pending}>Discard</Button>
          <Button onClick={()=>decide('save-and-switch')} disabled={saveState.pending}>Save &amp; switch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
      <DialogContent showCloseButton={!saveState.pending}>
        <DialogHeader>
          <DialogTitle>Upgrade to Contract v{latestContractVersion}?</DialogTitle>
          <DialogDescription>
            Compatible persisted inputs and governed configuration are carried forward by the existing server upgrade action. Verified Condition history is never changed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>setUpgradeOpen(false)} disabled={saveState.pending}>Cancel</Button>
          <Button
            onClick={()=>void upgradeContract().then((upgraded:boolean)=>{if(upgraded)setUpgradeOpen(false);})}
            disabled={!canUpgrade||saveState.pending}
          >Upgrade &amp; review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </aside>;
}
