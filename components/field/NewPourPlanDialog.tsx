import {createPourPlan} from '@/app/pour-control/actions';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';

type Option={id:string;label:string};

export function NewPourPlanDialog({today,projects,scopeLinks,changeOrders}:{today:string;projects:Option[];scopeLinks:Option[];changeOrders:Option[]}){
  return <Dialog>
    <DialogTrigger render={<Button className="absolute right-0 top-0"/>}>+ New Pour Plan</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>New pour plan</DialogTitle><DialogDescription>Set the job, date and expected concrete for dispatch.</DialogDescription></DialogHeader>
      <form action={createPourPlan} className="grid gap-3">
        <div className="grid gap-1"><Label htmlFor="new-pour-project">Project</Label><select id="new-pour-project" name="project_id" required defaultValue="" className="h-9 w-full border border-input bg-background px-2 text-sm"><option value="" disabled>Select project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.label}</option>)}</select></div>
        <div className="grid gap-1"><Label htmlFor="new-pour-name">Pour name / location</Label><Input id="new-pour-name" name="name" required/></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-1"><Label htmlFor="new-pour-date">Pour date</Label><Input id="new-pour-date" type="date" name="scheduled_date" defaultValue={today}/></div><div className="grid gap-1"><Label htmlFor="new-pour-cy">Expected concrete (CY)</Label><Input id="new-pour-cy" type="number" min="0" step="0.01" name="expected_concrete_yards" defaultValue="0"/></div></div>
        <div className="grid gap-1"><Label htmlFor="new-pour-notes">Dispatch notes</Label><Textarea id="new-pour-notes" name="notes" rows={2}/></div>
        <details className="border-t border-border pt-2 text-xs"><summary className="cursor-pointer font-medium text-muted-foreground">Scope links (optional)</summary><div className="mt-2 grid gap-2"><div className="grid gap-1"><Label htmlFor="new-pour-budget">Budget scope</Label><select id="new-pour-budget" name="budget_section_id" defaultValue="" className="h-9 w-full border border-input bg-background px-2 text-sm"><option value="">Unassigned</option>{scopeLinks.map(scope=><option key={scope.id} value={scope.id}>{scope.label}</option>)}</select></div><div className="grid gap-1"><Label htmlFor="new-pour-co">Approved change order</Label><select id="new-pour-co" name="change_order_id" defaultValue="" className="h-9 w-full border border-input bg-background px-2 text-sm"><option value="">Original contract work</option>{changeOrders.map(order=><option key={order.id} value={order.id}>{order.label}</option>)}</select></div></div></details>
        <input type="hidden" name="contingency_percent" value="10"/>
        <Button type="submit" className="justify-self-end">Create plan</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
