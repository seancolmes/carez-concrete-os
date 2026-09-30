'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import { AddRegular as Plus } from '@fluentui/react-icons';
import {createLead} from '@/app/leads/actions';
import {createEstimate} from '@/app/estimates/actions';
import {Button,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger,Input,Label,Select,Textarea} from '@fluentui/react-components';

export function OpportunityActions({projects}:{projects:{id:string;job_number:string|null;name:string}[]}){
  const router=useRouter();
  const [opportunityOpen,setOpportunityOpen]=useState(false);
  const [creating,setCreating]=useState(false);
  const [createError,setCreateError]=useState('');

  async function submitOpportunity(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(creating)return;
    const form=event.currentTarget;
    setCreating(true);
    setCreateError('');
    try{
      await createLead(new FormData(form));
      form.reset();
      setOpportunityOpen(false);
      router.refresh();
    }catch{
      setCreateError('The opportunity could not be created. Please try again or contact your workspace administrator.');
    }finally{
      setCreating(false);
    }
  }

  return <div className="flex flex-wrap items-center gap-2">
    <Dialog open={opportunityOpen} onOpenChange={(_,data)=>{setOpportunityOpen(data.open);if(!data.open)setCreateError('');}}>
      <DialogTrigger><Button appearance="primary" size="small" icon={<Plus/>}>New opportunity</Button></DialogTrigger>
      <DialogSurface className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogBody><DialogTitle>New opportunity</DialogTitle><DialogContent>
        <p className="mb-3 text-xs text-muted-foreground">The opportunity number follows this work through estimating and proposal.</p>
        <form onSubmit={submitOpportunity} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="op-customer">Customer / GC</Label><Input appearance="underline" id="op-customer" name="customer_name" required/></div><div className="grid gap-1"><Label htmlFor="op-project">Project name</Label><Input appearance="underline" id="op-project" name="project_name"/></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="op-contact">Contact</Label><Input appearance="underline" id="op-contact" name="contact_name"/></div><div className="grid gap-1"><Label htmlFor="op-email">Email</Label><Input appearance="underline" id="op-email" name="email" type="email"/></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="op-phone">Phone</Label><Input appearance="underline" id="op-phone" name="phone" type="tel"/></div><div className="grid gap-1"><Label htmlFor="op-address">Project address</Label><Input appearance="underline" id="op-address" name="address"/></div></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="grid gap-1"><Label htmlFor="op-city">City</Label><Input appearance="underline" id="op-city" name="city"/></div><div className="grid gap-1"><Label htmlFor="op-state">State</Label><Input appearance="underline" id="op-state" name="state" defaultValue="WA"/></div><div className="grid gap-1"><Label htmlFor="op-zip">ZIP</Label><Input appearance="underline" id="op-zip" name="postal_code"/></div></div>
          <div className="grid gap-1"><Label htmlFor="op-scope">Concrete work</Label><Textarea appearance="outline" id="op-scope" name="scope" rows={2}/></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="op-value">Rough value</Label><Input appearance="underline" id="op-value" name="estimated_value" inputMode="decimal"/></div><div className="grid gap-1"><Label htmlFor="op-source">Lead source</Label><Select appearance="outline" id="op-source" name="source" defaultValue="manual" className="h-9 rounded-sm border border-input bg-background px-2 text-sm"><option value="manual">Entered manually</option><option value="phone">Phone</option><option value="website">Website</option><option value="referral">Referral</option><option value="gc_invitation">GC invitation</option><option value="repeat_customer">Repeat customer</option><option value="other">Other</option></Select></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="op-bid-due">Bid due</Label><Input appearance="underline" id="op-bid-due" name="bid_due" type="date"/></div><div className="grid gap-1"><Label htmlFor="op-follow">Follow up</Label><Input appearance="underline" id="op-follow" name="follow_up" type="date"/></div></div>
          <div className="grid gap-1"><Label htmlFor="op-notes">Notes</Label><Textarea appearance="outline" id="op-notes" name="notes" rows={2}/></div>
          {createError?<p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{createError}</p>:null}
          <div className="flex justify-end"><Button type="submit" appearance="primary" disabled={creating}>{creating?'Creating...':'Create opportunity'}</Button></div>
        </form>
      </DialogContent></DialogBody></DialogSurface>
    </Dialog>
    <Dialog>
      <DialogTrigger><Button appearance="outline" size="small">Standalone estimate</Button></DialogTrigger>
      <DialogSurface className="sm:max-w-lg"><DialogBody><DialogTitle>Standalone estimate</DialogTitle><DialogContent>
        <p className="mb-3 text-xs text-muted-foreground">Use this when no customer opportunity exists to carry forward.</p>
        <form action={createEstimate} className="grid gap-3"><div className="grid gap-1"><Label htmlFor="op-estimate-name">Description</Label><Input appearance="underline" id="op-estimate-name" name="name"/></div><div className="grid gap-1"><Label htmlFor="op-estimate-project">Existing job</Label><Select appearance="outline" id="op-estimate-project" name="project_id" defaultValue=""><option value="">New opportunity</option>{projects.map(project=><option key={project.id} value={project.id}>{project.job_number} — {project.name}</option>)}</Select></div><div className="flex justify-end"><Button type="submit" appearance="primary">Create estimate</Button></div></form>
      </DialogContent></DialogBody></DialogSurface>
    </Dialog>
  </div>;
}
