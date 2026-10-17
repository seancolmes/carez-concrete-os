'use client';

import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Button,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger,Input,Label,Select} from '@fluentui/react-components';
import {addEstimateSection,addEstimateItem} from '@/app/estimates/actions';

const units=['CY','LF','SF','LB','EA','HR','DAY','TON','GAL','LS'];

export function AddScopeAreaDialog({estimateId}:{estimateId:string}){
  return <Dialog>
    <DialogTrigger disableButtonEnhancement><Button type="button" appearance="outline" size="small">Add scope area</Button></DialogTrigger>
    <DialogSurface className="pt-dialog"><DialogBody>
      <DialogTitle>Add scope area</DialogTitle>
      <DialogContent>
        <p className="mb-4 text-sm text-muted-foreground">Add a physical area or assembly to this revision.</p>
        <form action={addEstimateSection} className="grid gap-4">
          <input type="hidden" name="estimate_id" value={estimateId}/>
          <div className="grid gap-2"><Label htmlFor="scope-name">Physical area / assembly</Label><Input appearance="underline" id="scope-name" name="name" required placeholder="Basement Walls · Garage Slab · Driveway"/></div>
          <div className="grid gap-2"><Label htmlFor="scope-type">Concrete work type</Label><Select id="scope-type" name="scope_type" defaultValue="footing"><option value="footing">Footing</option><option value="wall">Wall</option><option value="flatwork">Flatwork</option><option value="curb">Curb / Sidewalk</option><option value="repair">Repair</option><option value="other">Other</option></Select></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DialogTrigger action="close"><Button type="button" appearance="outline">Cancel</Button></DialogTrigger>
            <Button type="submit" appearance="primary">Add scope area</Button>
          </div>
        </form>
      </DialogContent>
    </DialogBody></DialogSurface>
  </Dialog>;
}

export function AddExceptionCostDialog({estimateId,sections,catalog,codes,crew,risk}:{estimateId:string;sections:any[];catalog:any[];codes:any[];crew:any[];risk:any[]}){
  return <Dialog>
    <DialogTrigger disableButtonEnhancement><Button type="button" appearance="outline" size="small">Add exception cost</Button></DialogTrigger>
    <DialogSurface className="pt-dialog max-h-[85dvh] overflow-y-auto"><DialogBody>
      <DialogTitle>Add cost outside the assembly</DialogTitle>
      <DialogContent>
        <p className="mb-4 text-sm text-muted-foreground">Use this for a real cost that the concrete takeoff assembly does not represent.</p>
        <form action={addEstimateItem} className="grid gap-4">
          <input type="hidden" name="estimate_id" value={estimateId}/>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="exception-section">Scope area</Label><Select id="exception-section" name="section_id" defaultValue=""><option value="">Unassigned / general</option>{sections.map(section=><option key={section.id} value={section.id}>{section.name}</option>)}</Select></div>
            <div className="grid gap-2"><Label htmlFor="exception-type">Cost type</Label><Select id="exception-type" name="item_type" defaultValue="material"><option value="labor">Labor</option><option value="material">Material</option><option value="equipment">Equipment</option><option value="subcontractor">Subcontractor</option><option value="other">Other</option></Select></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="exception-description">Description</Label><Input appearance="underline" id="exception-description" name="description" required placeholder="Concrete pump · specialty finish · unusual rental…"/></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="exception-catalog">Saved cost item</Label><Select id="exception-catalog" name="catalog_item_id" defaultValue=""><option value="">Custom</option>{catalog.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
            <div className="grid gap-2"><Label htmlFor="exception-code">Cost code</Label><Select id="exception-code" name="cost_code_id" defaultValue=""><option value="">Automatic / none</option>{codes.map(code=><option key={code.id} value={code.id}>{code.code} — {code.name}</option>)}</Select></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="exception-quantity">Quantity</Label><Input appearance="underline" id="exception-quantity" name="quantity" type="number" step="0.01" min="0" defaultValue="1"/></div>
            <div className="grid gap-2"><Label htmlFor="exception-unit">Unit</Label><Select id="exception-unit" name="unit" defaultValue="LS">{units.map(unit=><option key={unit} value={unit}>{unit}</option>)}</Select></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="exception-unit-cost">Unit cost</Label><Input appearance="underline" id="exception-unit-cost" name="unit_cost" type="number" step="0.01" min="0" defaultValue="0"/></div>
          <Accordion collapsible><AccordionItem value="labor"><AccordionHeader>Labor-only fields</AccordionHeader><AccordionPanel>
            <div className="grid gap-3">
              <div className="grid gap-2"><Label htmlFor="exception-worker">Worker</Label><Select id="exception-worker" name="crew_member_id" defaultValue=""><option value="">Not labor</option>{crew.map(worker=><option key={worker.id} value={worker.id}>{worker.name}</option>)}</Select></div>
              <div className="grid gap-2"><Label htmlFor="exception-risk">L&amp;I work class</Label><Select id="exception-risk" name="risk_class_code" defaultValue="0217-01"><option value="">Owner / not applicable</option>{risk.map(row=><option key={row.code} value={row.code}>{row.code} — {row.name}</option>)}</Select></div>
              <div className="grid gap-2"><Label htmlFor="exception-task">Labor operation</Label><Select id="exception-task" name="labor_task" defaultValue="General">{['Formwork','Rebar','Placement','Finishing','Strip','Cleanup','Layout','General'].map(task=><option key={task} value={task}>{task}</option>)}</Select></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="exception-regular-hours">Regular hours</Label><Input appearance="underline" id="exception-regular-hours" name="regular_hours" type="number" step="0.25" min="0"/></div><div className="grid gap-2"><Label htmlFor="exception-ot-hours">OT hours</Label><Input appearance="underline" id="exception-ot-hours" name="overtime_hours" type="number" step="0.25" min="0"/></div></div>
            </div>
          </AccordionPanel></AccordionItem></Accordion>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DialogTrigger action="close"><Button type="button" appearance="outline">Cancel</Button></DialogTrigger>
            <Button type="submit" appearance="primary">Add exception cost</Button>
          </div>
        </form>
      </DialogContent>
    </DialogBody></DialogSurface>
  </Dialog>;
}
