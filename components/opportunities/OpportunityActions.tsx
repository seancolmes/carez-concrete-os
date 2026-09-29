import {Plus} from 'lucide-react';
import {createLead} from '@/app/leads/actions';
import {createEstimate} from '@/app/estimates/actions';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';

export function OpportunityActions({projects}:{projects:{id:string;job_number:string|null;name:string}[]}){
  return <div className="flex flex-wrap items-center gap-2">
    <Dialog>
      <DialogTrigger render={<Button size="sm"/>}><Plus/>New opportunity</DialogTrigger>
      <DialogContent overlayClassName="bg-black/60 backdrop-blur-md" className="max-h-[90vh] overflow-y-auto border border-[#D4DBD7] bg-white/95 shadow-2xl backdrop-blur-md sm:max-w-2xl dark:border-[#343A3F] dark:bg-[#181A1B]/95">
        <DialogHeader><DialogTitle>New opportunity</DialogTitle><DialogDescription>The opportunity number follows this work through estimating and proposal.</DialogDescription></DialogHeader>
        <form action={createLead} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="op-customer">Customer / GC</Label><Input id="op-customer" name="customer_name" required/></div><div className="grid gap-1"><Label htmlFor="op-project">Project name</Label><Input id="op-project" name="project_name"/></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="op-contact">Contact</Label><Input id="op-contact" name="contact_name"/></div><div className="grid gap-1"><Label htmlFor="op-email">Email</Label><Input id="op-email" name="email" type="email"/></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="op-phone">Phone</Label><Input id="op-phone" name="phone" type="tel"/></div><div className="grid gap-1"><Label htmlFor="op-address">Project address</Label><Input id="op-address" name="address"/></div></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="grid gap-1"><Label htmlFor="op-city">City</Label><Input id="op-city" name="city"/></div><div className="grid gap-1"><Label htmlFor="op-state">State</Label><Input id="op-state" name="state" defaultValue="WA"/></div><div className="grid gap-1"><Label htmlFor="op-zip">ZIP</Label><Input id="op-zip" name="postal_code"/></div></div>
          <div className="grid gap-1"><Label htmlFor="op-scope">Concrete work</Label><Textarea id="op-scope" name="scope" rows={2}/></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="op-value">Rough value</Label><Input id="op-value" name="estimated_value" inputMode="decimal"/></div><div className="grid gap-1"><Label htmlFor="op-source">Lead source</Label><select id="op-source" name="source" defaultValue="manual" className="h-9 rounded-sm border border-input bg-background px-2 text-sm"><option value="manual">Entered manually</option><option value="phone">Phone</option><option value="website">Website</option><option value="referral">Referral</option><option value="gc_invitation">GC invitation</option><option value="repeat_customer">Repeat customer</option><option value="other">Other</option></select></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="op-bid-due">Bid due</Label><Input id="op-bid-due" name="bid_due" type="date"/></div><div className="grid gap-1"><Label htmlFor="op-follow">Follow up</Label><Input id="op-follow" name="follow_up" type="date"/></div></div>
          <div className="grid gap-1"><Label htmlFor="op-notes">Notes</Label><Textarea id="op-notes" name="notes" rows={2}/></div>
          <div className="flex justify-end"><Button type="submit">Create opportunity</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm"/>}>Standalone estimate</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Standalone estimate</DialogTitle><DialogDescription>Use this when no customer opportunity exists to carry forward.</DialogDescription></DialogHeader>
        <form action={createEstimate} className="grid gap-3"><div className="grid gap-1"><Label htmlFor="op-estimate-name">Description</Label><Input id="op-estimate-name" name="name"/></div><div className="grid gap-1"><Label htmlFor="op-estimate-project">Existing job</Label><select id="op-estimate-project" name="project_id" defaultValue="" className="h-9 rounded-sm border border-input bg-background px-2 text-sm"><option value="">New opportunity</option>{projects.map(project=><option key={project.id} value={project.id}>{project.job_number} — {project.name}</option>)}</select></div><div className="flex justify-end"><Button type="submit">Create estimate</Button></div></form>
      </DialogContent>
    </Dialog>
  </div>;
}
