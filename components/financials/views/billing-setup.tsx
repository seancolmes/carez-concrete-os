import {redirect} from 'next/navigation';
import Link from 'next/link';
import {Button,buttonVariants} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle,SheetTrigger} from '@/components/ui/sheet';
import {Card} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {createClient} from '@/lib/supabase/server';
import {updateCompanyBillingProfile,updateCustomerBillingProfile,updateProjectBillingSetup} from '@/app/billing/actions';

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

 return <><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3">
  <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Billing setup</h1><div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/billing">Billing</Link><Dialog><DialogTrigger render={<Button size="sm"/>}>Company invoice profile</DialogTrigger><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Company invoice profile</DialogTitle><DialogDescription>Information shown on new customer invoices. Already-issued records keep their snapshot.</DialogDescription></DialogHeader><form action={updateCompanyBillingProfile} className="grid gap-4">

   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-display-name">Business Name</Label><Input id="billing-display-name" name="display_name" defaultValue={bp?.display_name||'Carez Concrete'} required/></div><div className="grid gap-2"><Label htmlFor="billing-legal-name">Legal Name</Label><Input id="billing-legal-name" name="legal_name" defaultValue={bp?.legal_name||''}/></div></div>
   <div className="grid gap-2"><Label htmlFor="billing-address">Business Address</Label><Input id="billing-address" name="address_line1" defaultValue={bp?.address_line1||''}/></div>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-city">City</Label><Input id="billing-city" name="city" defaultValue={bp?.city||''}/></div><div className="grid gap-2"><Label htmlFor="billing-state">State</Label><Input id="billing-state" name="state" defaultValue={bp?.state||'WA'}/></div></div>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-zip">ZIP</Label><Input id="billing-zip" name="postal_code" defaultValue={bp?.postal_code||''}/></div><div className="grid gap-2"><Label htmlFor="billing-phone">Phone</Label><Input id="billing-phone" name="phone" defaultValue={bp?.phone||''}/></div></div>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-email">Billing Email</Label><Input id="billing-email" type="email" name="email" defaultValue={bp?.email||''}/></div><div className="grid gap-2"><Label htmlFor="billing-website">Website</Label><Input id="billing-website" name="website" defaultValue={bp?.website||''}/></div></div>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-ubi">WA UBI</Label><Input id="billing-ubi" name="ubi_number" defaultValue={bp?.ubi_number||''}/></div><div className="grid gap-2"><Label htmlFor="billing-license">Contractor License</Label><Input id="billing-license" name="contractor_license_number" defaultValue={bp?.contractor_license_number||''}/></div></div>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="billing-due-days">Default Days to Pay</Label><Input id="billing-due-days" type="number" name="default_due_days" min="0" defaultValue={num(bp?.default_due_days)}/></div><div className="grid gap-2"><Label htmlFor="billing-terms">Default Terms</Label><Input id="billing-terms" name="default_terms_text" defaultValue={bp?.default_terms_text||''} placeholder="Due on receipt / Net 15"/></div></div>
   <div className="grid gap-2"><Label htmlFor="billing-payment-instructions">How Customers Pay Us</Label><Textarea id="billing-payment-instructions" rows={3} name="payment_instructions" defaultValue={bp?.payment_instructions||''}/></div>
   <div className="grid gap-2"><Label htmlFor="billing-footer">Invoice Footer</Label><Textarea id="billing-footer" rows={2} name="invoice_footer" defaultValue={bp?.invoice_footer||''}/></div>
   <Button type="submit" className="w-fit">Save invoice profile</Button>
  </form></DialogContent></Dialog></div></header>

  <section className="space-y-3" aria-labelledby="customer-tax-setup"><div className="carez-section-heading"><h2 id="customer-tax-setup">Customer and sales tax setup</h2></div>
   {(projects||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No jobs available for billing setup</EmptyTitle><EmptyDescription>Active, on-hold, and completed projects will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-2">{(projects||[]).map((x:any)=>{const c:any=x.customers;return <Card key={x.id} className="gap-0 py-0"><Sheet><div className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><strong className="block truncate">{x.job_number} · {x.name}</strong><span className="text-xs text-muted-foreground">{c?.name||'Customer not linked'} · Tax {num(x.sales_tax_rate_percent)}%</span></div><SheetTrigger render={<Button variant="outline" size="sm"/>}>View / Edit</SheetTrigger></div><SheetContent className="w-full overflow-hidden sm:max-w-2xl"><SheetHeader><SheetTitle>{x.job_number} · {x.name}</SheetTitle><SheetDescription>Customer bill-to and job sales tax setup</SheetDescription></SheetHeader><div className="grid gap-4 overflow-y-auto px-4 pb-6">
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
   </div></SheetContent></Sheet></Card>})}</div>}
  </section>
 </div></>;
}
