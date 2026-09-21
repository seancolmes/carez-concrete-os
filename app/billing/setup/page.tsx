import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {createClient} from '@/lib/supabase/server';
import {updateCompanyBillingProfile,updateCustomerBillingProfile,updateProjectBillingSetup} from '../actions';

const num=(n:any)=>Number(n||0);
const checkboxClass='size-4 rounded border-input accent-primary';

export default async function BillingSetupPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!p?.company_id)redirect('/login');
 if(p.role==='employee')redirect('/employee');
 const [{data:bp},{data:projects}]=await Promise.all([
  supabase.from('company_billing_profiles').select('*').eq('company_id',p.company_id).maybeSingle(),
  supabase.from('projects').select('id,job_number,name,sales_tax_rate_percent,sales_tax_exempt,sales_tax_jurisdiction,customers(id,name,contact_name,email,phone,billing_terms,billing_address_line1,billing_address_line2,billing_city,billing_state,billing_postal_code)').in('status',['active','on_hold','completed']).order('job_number')
 ]);

 return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
   <header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Billing Setup</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Company invoice information, customer bill-to information and job sales-tax setup. This is setup data, not daily bookkeeping.</p></header>
   <Link className={buttonVariants({variant:'outline'})} href="/billing">Back to Billing</Link>
  </div>

  <Card className="shadow-none"><CardHeader><CardTitle>Carez Invoice Information</CardTitle><CardDescription>What customers see at the top and bottom of Carez invoices.</CardDescription></CardHeader><CardContent><form action={updateCompanyBillingProfile} className="grid gap-4">
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-display-name">Business Name</Label><Input id="billing-display-name" name="display_name" defaultValue={bp?.display_name||'Carez Concrete'} required/></div><div className="grid gap-2"><Label htmlFor="billing-legal-name">Legal Name</Label><Input id="billing-legal-name" name="legal_name" defaultValue={bp?.legal_name||''}/></div></div>
   <div className="grid gap-2"><Label htmlFor="billing-address">Business Address</Label><Input id="billing-address" name="address_line1" defaultValue={bp?.address_line1||''}/></div>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-city">City</Label><Input id="billing-city" name="city" defaultValue={bp?.city||''}/></div><div className="grid gap-2"><Label htmlFor="billing-state">State</Label><Input id="billing-state" name="state" defaultValue={bp?.state||'WA'}/></div></div>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-zip">ZIP</Label><Input id="billing-zip" name="postal_code" defaultValue={bp?.postal_code||''}/></div><div className="grid gap-2"><Label htmlFor="billing-phone">Phone</Label><Input id="billing-phone" name="phone" defaultValue={bp?.phone||''}/></div></div>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-email">Billing Email</Label><Input id="billing-email" type="email" name="email" defaultValue={bp?.email||''}/></div><div className="grid gap-2"><Label htmlFor="billing-website">Website</Label><Input id="billing-website" name="website" defaultValue={bp?.website||''}/></div></div>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-ubi">WA UBI</Label><Input id="billing-ubi" name="ubi_number" defaultValue={bp?.ubi_number||''}/></div><div className="grid gap-2"><Label htmlFor="billing-license">Contractor License</Label><Input id="billing-license" name="contractor_license_number" defaultValue={bp?.contractor_license_number||''}/></div></div>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-due-days">Default Days to Pay</Label><Input id="billing-due-days" type="number" name="default_due_days" min="0" defaultValue={num(bp?.default_due_days)}/></div><div className="grid gap-2"><Label htmlFor="billing-terms">Default Terms</Label><Input id="billing-terms" name="default_terms_text" defaultValue={bp?.default_terms_text||''} placeholder="Due on receipt / Net 15"/></div></div>
   <div className="grid gap-2"><Label htmlFor="billing-payment-instructions">How Customers Pay Us</Label><Textarea id="billing-payment-instructions" rows={3} name="payment_instructions" defaultValue={bp?.payment_instructions||''}/></div>
   <div className="grid gap-2"><Label htmlFor="billing-footer">Invoice Footer</Label><Textarea id="billing-footer" rows={2} name="invoice_footer" defaultValue={bp?.invoice_footer||''}/></div>
   <Button type="submit" className="w-fit">Save Carez Invoice Setup</Button>
  </form></CardContent></Card>

  <section className="space-y-4" aria-labelledby="customer-tax-setup"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Jobs</div><h2 id="customer-tax-setup" className="mt-1 text-lg font-semibold">Customer &amp; Sales Tax Setup</h2><p className="mt-1 text-sm text-muted-foreground">Set these once per job so invoices calculate correctly.</p></div>
   {(projects||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No jobs available for billing setup</EmptyTitle><EmptyDescription>Active, on-hold, and completed projects will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{(projects||[]).map((x:any)=>{const c:any=x.customers;return <Card key={x.id}><header className="carez-page-heading border-b border-border px-4 pb-4"><h3 className="font-semibold">{x.job_number} — {x.name}</h3><p className="mt-1 text-sm text-muted-foreground">{c?.name||'Customer not linked'}</p></header><CardContent><div className="grid gap-5 xl:grid-cols-2">
    <form action={updateProjectBillingSetup} className="grid content-start gap-4 rounded-lg border border-border bg-muted/10 p-4"><input type="hidden" name="project_id" value={x.id}/><div><h4 className="font-semibold">Job Sales Tax</h4><p className="mt-1 text-xs text-muted-foreground">Tax rate, jurisdiction, and exemption status for this project.</p></div>
     <div className="grid gap-2"><Label htmlFor={`tax-rate-${x.id}`}>Tax Rate %</Label><Input id={`tax-rate-${x.id}`} type="number" min="0" step="0.001" name="sales_tax_rate_percent" defaultValue={num(x.sales_tax_rate_percent)}/></div>
     <div className="grid gap-2"><Label htmlFor={`tax-jurisdiction-${x.id}`}>Jurisdiction</Label><Input id={`tax-jurisdiction-${x.id}`} name="sales_tax_jurisdiction" defaultValue={x.sales_tax_jurisdiction||''}/></div>
     <label className="flex items-center gap-2 text-sm text-muted-foreground"><input className={checkboxClass} type="checkbox" name="sales_tax_exempt" defaultChecked={Boolean(x.sales_tax_exempt)}/>Tax-exempt job/customer</label>
     <Button type="submit" variant="outline" className="w-fit">Save Tax Setup</Button>
    </form>

    {c?<form action={updateCustomerBillingProfile} className="grid content-start gap-4 rounded-lg border border-border bg-muted/10 p-4"><input type="hidden" name="customer_id" value={c.id}/><div><h4 className="font-semibold">Where to Send the Bill</h4><p className="mt-1 text-xs text-muted-foreground">Customer contact, billing address, and terms.</p></div>
     <div className="grid gap-2"><Label htmlFor={`customer-contact-${x.id}`}>Contact</Label><Input id={`customer-contact-${x.id}`} name="contact_name" defaultValue={c.contact_name||''}/></div>
     <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`customer-email-${x.id}`}>Email</Label><Input id={`customer-email-${x.id}`} type="email" name="email" defaultValue={c.email||''}/></div><div className="grid gap-2"><Label htmlFor={`customer-phone-${x.id}`}>Phone</Label><Input id={`customer-phone-${x.id}`} name="phone" defaultValue={c.phone||''}/></div></div>
     <div className="grid gap-2"><Label htmlFor={`customer-address-${x.id}`}>Billing Address</Label><Input id={`customer-address-${x.id}`} name="billing_address_line1" defaultValue={c.billing_address_line1||''}/></div>
     <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`customer-city-${x.id}`}>City</Label><Input id={`customer-city-${x.id}`} name="billing_city" defaultValue={c.billing_city||''}/></div><div className="grid gap-2"><Label htmlFor={`customer-state-${x.id}`}>State</Label><Input id={`customer-state-${x.id}`} name="billing_state" defaultValue={c.billing_state||'WA'}/></div></div>
     <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`customer-zip-${x.id}`}>ZIP</Label><Input id={`customer-zip-${x.id}`} name="billing_postal_code" defaultValue={c.billing_postal_code||''}/></div><div className="grid gap-2"><Label htmlFor={`customer-terms-${x.id}`}>Terms</Label><Input id={`customer-terms-${x.id}`} name="billing_terms" defaultValue={c.billing_terms||''}/></div></div>
     <Button type="submit" variant="outline" className="w-fit">Save Customer Billing</Button>
    </form>:<div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">Link this project to a customer before sending invoices.</div>}
   </div></CardContent></Card>})}</div>}
  </section>
 </div></AppShell>;
}
