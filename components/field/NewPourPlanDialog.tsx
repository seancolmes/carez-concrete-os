import {createPourPlan} from '@/app/pour-control/actions';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Button,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger,Input,Label,Select,Textarea} from '@fluentui/react-components';

type Option={id:string;label:string};

export function NewPourPlanDialog({today,projects,scopeLinks,changeOrders}:{today:string;projects:Option[];scopeLinks:Option[];changeOrders:Option[]}){
  return <Dialog>
    <DialogTrigger><Button appearance="primary" className="absolute right-0 top-0">+ New Pour Plan</Button></DialogTrigger>
    <DialogSurface className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogBody><DialogTitle>New pour plan</DialogTitle><DialogContent><p className="mb-3 text-sm text-muted-foreground">Set the job, date and expected concrete for dispatch.</p>
      <form action={createPourPlan} className="grid gap-3">
        <div className="grid gap-1"><Label htmlFor="new-pour-project">Project</Label><Select appearance="outline" id="new-pour-project" name="project_id" required defaultValue="" className="h-9 w-full border border-input bg-background px-2 text-sm"><option value="" disabled>Select project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.label}</option>)}</Select></div>
        <div className="grid gap-1"><Label htmlFor="new-pour-name">Pour name / location</Label><Input appearance="underline" id="new-pour-name" name="name" required/></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-1"><Label htmlFor="new-pour-date">Pour date</Label><Input appearance="underline" id="new-pour-date" type="date" name="scheduled_date" defaultValue={today}/></div><div className="grid gap-1"><Label htmlFor="new-pour-cy">Expected concrete (CY)</Label><Input appearance="underline" id="new-pour-cy" type="number" min="0" step="0.01" name="expected_concrete_yards" defaultValue="0"/></div></div>
        <div className="grid gap-1"><Label htmlFor="new-pour-notes">Dispatch notes</Label><Textarea appearance="outline" id="new-pour-notes" name="notes" rows={2}/></div>
        <Accordion collapsible><AccordionItem value="content" className="border-t border-border pt-2 text-xs"><AccordionHeader className="cursor-pointer font-medium text-muted-foreground">Scope links (optional)</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="mt-2 grid gap-2"><div className="grid gap-1"><Label htmlFor="new-pour-budget">Budget scope</Label><Select appearance="outline" id="new-pour-budget" name="budget_section_id" defaultValue="" className="h-9 w-full border border-input bg-background px-2 text-sm"><option value="">Unassigned</option>{scopeLinks.map(scope=><option key={scope.id} value={scope.id}>{scope.label}</option>)}</Select></div><div className="grid gap-1"><Label htmlFor="new-pour-co">Approved change order</Label><Select appearance="outline" id="new-pour-co" name="change_order_id" defaultValue="" className="h-9 w-full border border-input bg-background px-2 text-sm"><option value="">Original contract work</option>{changeOrders.map(order=><option key={order.id} value={order.id}>{order.label}</option>)}</Select></div></div></AccordionPanel></AccordionItem></Accordion>
        <input type="hidden" name="contingency_percent" value="10"/>
        <Button type="submit" appearance="primary" className="justify-self-end">Create plan</Button>
      </form>
    </DialogContent></DialogBody></DialogSurface>
  </Dialog>;
}
