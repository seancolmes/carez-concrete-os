'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {AddRegular} from '@fluentui/react-icons';
import {Button,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,Field,Input,Menu,MenuButton,MenuItem,MenuList,MenuPopover,MenuTrigger,Select,Textarea} from '@fluentui/react-components';
import {createLead} from '@/app/leads/actions';
import {createEstimate} from '@/app/estimates/actions';

const control='min-w-0 w-full';
const pair='grid min-w-0 gap-3 sm:grid-cols-2';

export function OpportunityActions({projects}:{projects:{id:string;job_number:string|null;name:string}[]}){
  const router=useRouter();
  const [opportunityOpen,setOpportunityOpen]=useState(false);
  const [estimateOpen,setEstimateOpen]=useState(false);
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

  return <>
    <Menu>
      <MenuTrigger disableButtonEnhancement><MenuButton appearance="primary" size="small" icon={<AddRegular/>}>New</MenuButton></MenuTrigger>
      <MenuPopover><MenuList>
        <MenuItem onClick={()=>setOpportunityOpen(true)}>Opportunity</MenuItem>
        <MenuItem onClick={()=>setEstimateOpen(true)}>Standalone estimate</MenuItem>
      </MenuList></MenuPopover>
    </Menu>

    <Dialog open={opportunityOpen} onOpenChange={(_,data)=>{setOpportunityOpen(data.open);if(!data.open)setCreateError('');}}>
      <DialogSurface className="max-h-[90dvh] w-[min(48rem,calc(100vw-2rem))] max-w-none overflow-x-hidden p-0">
        <DialogBody className="min-w-0 max-h-[90dvh] overflow-y-auto overflow-x-hidden p-5 sm:p-6">
          <DialogTitle>New opportunity</DialogTitle>
          <DialogContent className="min-w-0">
            <p className="mb-4 text-xs text-muted-foreground">The opportunity number follows this work through estimating and proposal.</p>
            <form onSubmit={submitOpportunity} className="grid min-w-0 gap-3 [&_.fui-Field]:min-w-0">
              <div className={pair}>
                <Field label="Customer / GC" required><Input appearance="underline" name="customer_name" required autoFocus className={control}/></Field>
                <Field label="Project name"><Input appearance="underline" name="project_name" className={control}/></Field>
              </div>
              <div className={pair}>
                <Field label="Contact"><Input appearance="underline" name="contact_name" className={control}/></Field>
                <Field label="Email"><Input appearance="underline" name="email" type="email" className={control}/></Field>
              </div>
              <div className={pair}>
                <Field label="Phone"><Input appearance="underline" name="phone" type="tel" className={control}/></Field>
                <Field label="Project address"><Input appearance="underline" name="address" className={control}/></Field>
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                <Field label="City"><Input appearance="underline" name="city" className={control}/></Field>
                <Field label="State"><Input appearance="underline" name="state" className={control}/></Field>
                <Field label="ZIP"><Input appearance="underline" name="postal_code" className={control}/></Field>
              </div>
              <Field label="Concrete work"><Textarea appearance="outline" name="scope" rows={2} className={control}/></Field>
              <div className={pair}>
                <Field label="Rough value"><Input appearance="underline" name="estimated_value" inputMode="decimal" className={control}/></Field>
                <Field label="Lead source"><Select appearance="outline" name="source" defaultValue="manual" className={control}><option value="manual">Entered manually</option><option value="phone">Phone</option><option value="website">Website</option><option value="referral">Referral</option><option value="gc_invitation">GC invitation</option><option value="repeat_customer">Repeat customer</option><option value="other">Other</option></Select></Field>
              </div>
              <div className={pair}>
                <Field label="Bid due"><Input appearance="underline" name="bid_due" type="date" className={control}/></Field>
                <Field label="Follow up"><Input appearance="underline" name="follow_up" type="date" className={control}/></Field>
              </div>
              <Field label="Notes"><Textarea appearance="outline" name="notes" rows={2} className={control}/></Field>
              {createError?<p role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{createError}</p>:null}
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                <Button type="button" appearance="subtle" onClick={()=>setOpportunityOpen(false)} disabled={creating}>Cancel</Button>
                <Button type="submit" appearance="primary" disabled={creating}>{creating?'Creating…':'Create opportunity'}</Button>
              </div>
            </form>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>

    <Dialog open={estimateOpen} onOpenChange={(_,data)=>setEstimateOpen(data.open)}>
      <DialogSurface className="w-[min(32rem,calc(100vw-2rem))] max-w-none overflow-x-hidden">
        <DialogBody className="min-w-0"><DialogTitle>Standalone estimate</DialogTitle><DialogContent>
          <p className="mb-3 text-xs text-muted-foreground">Use this when no customer opportunity exists to carry forward.</p>
          <form action={createEstimate} className="grid min-w-0 gap-3">
            <Field label="Description"><Input appearance="underline" name="name" autoFocus className={control}/></Field>
            <Field label="Existing job"><Select appearance="outline" name="project_id" defaultValue="" className={control}><option value="">New opportunity</option>{projects.map(project=><option key={project.id} value={project.id}>{project.job_number} — {project.name}</option>)}</Select></Field>
            <div className="flex justify-end gap-2 border-t border-border pt-3"><Button type="button" appearance="subtle" onClick={()=>setEstimateOpen(false)}>Cancel</Button><Button type="submit" appearance="primary">Create estimate</Button></div>
          </form>
        </DialogContent></DialogBody>
      </DialogSurface>
    </Dialog>
  </>;
}
