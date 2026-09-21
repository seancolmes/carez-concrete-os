import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {createVendor} from '../actions';

const types=[['concrete_supplier','Concrete Supplier'],['pump','Concrete Pump'],['rebar_supplier','Rebar Supplier'],['building_materials','Building Materials'],['equipment_rental','Equipment Rental'],['trucking','Trucking / Hauling'],['traffic_control','Traffic Control'],['subcontractor','Subcontractor'],['other','Other']];
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function VendorsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');
  const {data:vendors}=await supabase.from('vendors').select('*').eq('company_id',p.company_id).order('active',{ascending:false}).order('vendor_type').order('name');

  const active=(vendors||[]).filter((v:any)=>v.active).length;
  const concrete=(vendors||[]).filter((v:any)=>v.vendor_type==='concrete_supplier').length;
  const rebar=(vendors||[]).filter((v:any)=>v.vendor_type==='rebar_supplier').length;

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><header className="carez-page-heading"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procurement</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Vendors</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">The companies Carez buys concrete, rebar, form material, rentals and subcontract work from.</p></header><Link className={buttonVariants({variant:'outline'})} href="/procurement">Back to Purchasing</Link></div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Active Vendors</div><div className="text-2xl font-semibold tabular-nums">{active}</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Concrete Suppliers</div><div className="text-2xl font-semibold tabular-nums">{concrete}</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Rebar Suppliers</div><div className="text-2xl font-semibold tabular-nums">{rebar}</div></CardContent></Card>
    </div>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card><CardContent className="space-y-4"><div><h2 className="font-semibold">Add Vendor</h2><p className="mt-1 text-sm text-muted-foreground">Enter it once; use it for quotes, POs and bills.</p></div><form action={createVendor} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="vendor-name">Vendor Name</Label><Input id="vendor-name" name="name" required/></div><div className="grid gap-2"><Label htmlFor="vendor-type">What Do They Supply?</Label><select id="vendor-type" className={selectClass} name="vendor_type">{types.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="vendor-contact">Contact</Label><Input id="vendor-contact" name="contact_name"/></div><div className="grid gap-2"><Label htmlFor="vendor-phone">Phone</Label><Input id="vendor-phone" name="phone"/></div></div>
        <div className="grid gap-2"><Label htmlFor="vendor-email">Email</Label><Input id="vendor-email" type="email" name="email"/></div>
        <div className="grid gap-2"><Label htmlFor="vendor-address">Address</Label><Input id="vendor-address" name="address_line1"/></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="vendor-city">City</Label><Input id="vendor-city" name="city"/></div><div className="grid gap-2"><Label htmlFor="vendor-state">State</Label><Input id="vendor-state" name="state" defaultValue="WA"/></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="vendor-zip">ZIP</Label><Input id="vendor-zip" name="postal_code"/></div><div className="grid gap-2"><Label htmlFor="vendor-terms">Terms</Label><Input id="vendor-terms" name="payment_terms" placeholder="Net 30, COD..."/></div></div>
        <div className="grid gap-2"><Label htmlFor="vendor-account">Account #</Label><Input id="vendor-account" name="account_number"/></div>
        <div className="grid gap-2"><Label htmlFor="vendor-notes">Notes</Label><Input id="vendor-notes" name="notes"/></div>
        <Button type="submit" className="w-fit">Save Vendor</Button>
      </form></CardContent></Card>

      <Card><CardContent className="space-y-4"><div><h2 className="font-semibold">Vendor Directory</h2><p className="mt-1 text-sm text-muted-foreground">Quick contact list for the field and office.</p></div>{(vendors||[]).length===0?<div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No vendors yet.</div>:<div className="divide-y rounded-lg border border-border">{(vendors||[]).map((v:any)=><div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between" key={v.id}><div className="min-w-0"><div className="font-medium">{v.name}</div><div className="mt-1 text-sm text-muted-foreground">{String(v.vendor_type).replaceAll('_',' ')} · {v.contact_name||'No contact'}</div><div className="mt-1 break-words text-sm text-muted-foreground">{v.phone||''}{v.phone&&v.email?' · ':''}{v.email||''}</div></div><Badge variant="outline" className={v.active?'shrink-0 border-success/30 bg-success/10 text-success':'shrink-0 text-muted-foreground'}>{v.active?'Active':'Inactive'}</Badge></div>)}</div>}</CardContent></Card>
    </section>
  </div></AppShell>;
}
