import {ProcurementForm} from '@/components/financials/ProcurementForm';
import {completeFinancialSum,financialNumber,financialMoney} from '@/lib/financials/amount';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Button,Dialog,DialogTitle,DialogTrigger,Input,Label,DialogBody,DialogContent,DialogSurface,Select} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {addCashReserve,releaseCashReserve,recordTaxRemittance,deleteTaxRemittance} from '@/app/cashflow/actions';

const money=financialMoney;
const reserveTypes=[['payroll','Payroll'],['payroll_tax','Payroll Taxes'],['bo_tax','B&O Tax'],['li','L&I'],['emergency','Emergency Buffer'],['owner','Owner Reserve'],['other','Other']];
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function ProtectedMoneyPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:cash,error:cashError},{data:reserves,error:reservesError},{data:remittances,error:remittancesError}]=await Promise.all([
    supabase.from('company_cash_position_summary').select('*').eq('company_id',p.company_id).maybeSingle(),
    supabase.from('company_cash_reserves').select('*').eq('company_id',p.company_id).order('active',{ascending:false}).order('due_date',{ascending:true,nullsFirst:false}),
    supabase.from('company_tax_remittances').select('*').eq('company_id',p.company_id).order('payment_date',{ascending:false}).limit(100),
  ]);

  const active=(reserves||[]).filter((r:any)=>r.active);
  const manual=completeFinancialSum(reservesError?null:active,'amount');
  const tax=cashError?null:financialNumber(cash?.sales_tax_reserve);
  const protectedTotal=manual!==null&&tax!==null?manual+tax:null;

  return <><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
    <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Protected money</h1><div className="flex flex-wrap gap-2"><Link className={secondaryLinkClass} href="/cashflow">Cash flow</Link><Dialog><DialogTrigger><Button appearance="outline" size="small">Record tax payment</Button></DialogTrigger><DialogSurface className="pt-dialog"><DialogBody><DialogContent><div><DialogTitle>Record tax payment</DialogTitle><p>Record a tax remittance that has actually left the bank.</p></div><ProcurementForm action={recordTaxRemittance} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="tax-type">Tax</Label><Select appearance="outline" id="tax-type" className={selectClass} name="tax_type" defaultValue="sales_tax"><option value="sales_tax">Sales Tax</option><option value="bo">B&amp;O Tax</option><option value="payroll">Payroll Tax</option><option value="li">L&amp;I</option><option value="other">Other Tax</option></Select></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="tax-payment-date">Date Paid</Label><Input appearance="underline" id="tax-payment-date" type="date" name="payment_date" required/></div><div className="grid gap-2"><Label htmlFor="tax-payment-amount">Amount</Label><Input appearance="underline" id="tax-payment-amount" type="number" min="0.01" step="0.01" name="amount" required/></div></div>
        <div className="grid gap-2"><Label htmlFor="tax-reference">Confirmation / Reference</Label><Input appearance="underline" id="tax-reference" name="reference_number"/></div>
        <div className="grid gap-2"><Label htmlFor="tax-note">Note</Label><Input appearance="underline" id="tax-note" name="notes"/></div>
        <Button type="submit" appearance="primary" className="w-fit">Record Tax Payment</Button>
      <DialogTrigger action="close"><Button type="button" appearance="secondary">Cancel</Button></DialogTrigger></ProcurementForm></DialogContent></DialogBody></DialogSurface></Dialog><Dialog><DialogTrigger><Button size="small">Protect money</Button></DialogTrigger><DialogSurface className="pt-dialog"><DialogBody><DialogContent><div><DialogTitle>Protect money</DialogTitle><p>Set cash aside for a specific obligation or reserve.</p></div><ProcurementForm action={addCashReserve} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="reserve-type">What Are We Protecting It For?</Label><Select appearance="outline" id="reserve-type" className={selectClass} name="reserve_type" defaultValue="other">{reserveTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></div>
        <div className="grid gap-2"><Label htmlFor="reserve-name">Name</Label><Input appearance="underline" id="reserve-name" name="name" required placeholder="September payroll buffer"/></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="reserve-amount">Amount</Label><Input appearance="underline" id="reserve-amount" type="number" min="0.01" step="0.01" name="amount" required/></div><div className="grid gap-2"><Label htmlFor="reserve-due">Needed By</Label><Input appearance="underline" id="reserve-due" type="date" name="due_date"/></div></div>
        <div className="grid gap-2"><Label htmlFor="reserve-note">Note</Label><Input appearance="underline" id="reserve-note" name="notes"/></div>
        <Button type="submit" appearance="primary" className="w-fit">Protect This Money</Button>
      <DialogTrigger action="close"><Button type="button" appearance="secondary">Cancel</Button></DialogTrigger></ProcurementForm></DialogContent></DialogBody></DialogSurface></Dialog></div></header>

    {(cashError||!cash)&&<p role="status" className="text-sm text-muted-foreground">{cashError?'Customer tax protection unavailable.':'Customer tax summary not recorded.'}</p>}
    <div className="grid grid-cols-3 divide-x border border-border bg-card/70" aria-label="Protected money summary"><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Protected total</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{money(protectedTotal)}</strong></div><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Customer tax</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{money(tax)}</strong></div><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Other reserves</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{money(manual)}</strong></div></div>

    <section className="space-y-2" aria-labelledby="protected-money-list"><div className="carez-page-heading"><h2 id="protected-money-list">Active reserves</h2></div>
      {reservesError?<p role="status" className="p-3 text-sm text-muted-foreground">Reserve records unavailable.</p>:active.length===0?<div className="border border-border"><div><h3>No manual reserves</h3><p>Sales tax protection comes from billing records.</p></div></div>:<div className="divide-y border border-border">{active.map((r:any)=><Dialog key={r.id}><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><strong className="block break-words text-sm">{r.name}</strong><span className="block break-words text-xs text-muted-foreground">{String(r.reserve_type).replaceAll('_',' ')}{r.due_date?` · Needed ${r.due_date}`:''}</span></div><div className="flex items-center gap-2"><strong className="font-mono text-sm tabular-nums">{money(r.amount)}</strong><DialogTrigger><Button appearance="outline" size="small">View details</Button></DialogTrigger></div></div><DialogSurface className="pt-dialog "><DialogBody><DialogContent><div className="flex justify-end"><DialogTrigger action="close"><Button type="button" appearance="subtle" size="small">Close</Button></DialogTrigger></div><div><DialogTitle>{r.name}</DialogTitle><p>{String(r.reserve_type).replaceAll('_',' ')} · {money(r.amount)}</p></div><div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-6"><div className="text-sm text-muted-foreground">{r.notes||'No note'}{r.due_date?` · Needed ${r.due_date}`:''}</div><Dialog><DialogTrigger><Button appearance="outline" size="small" className="w-fit">Release reserve</Button></DialogTrigger><DialogSurface className="pt-dialog"><DialogBody><DialogContent><div><DialogTitle>Release protected money?</DialogTitle><p>{money(r.amount)} will no longer be counted as a protected reserve.</p></div><ProcurementForm action={releaseCashReserve}><input type="hidden" name="reserve_id" value={r.id}/><input type="hidden" name="expected_updated_at" value={r.updated_at}/><Button type="submit" appearance="primary">Release reserve</Button><DialogTrigger action="close"><Button type="button" appearance="secondary">Cancel</Button></DialogTrigger></ProcurementForm></DialogContent></DialogBody></DialogSurface></Dialog></div></DialogContent></DialogBody></DialogSurface></Dialog> )}</div>}
    </section>

    <section className="space-y-4" aria-labelledby="tax-payment-history">
      <div className="carez-page-heading"><h2 id="tax-payment-history">Tax payments</h2></div>
      {remittancesError?<p role="status" className="p-3 text-sm text-muted-foreground">Tax payment history unavailable.</p>:(remittances||[]).length===0?<div className="border border-border"><div><h3>No tax payments recorded yet</h3><p>Recorded tax remittances will appear here.</p></div></div>:<div className="divide-y border border-border">{(remittances||[]).map((x:any)=><div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={x.id}><div><div className="font-medium">{x.payment_date} · {String(x.tax_type).replaceAll('_',' ')}</div><div className="mt-1 text-sm text-muted-foreground">{x.reference_number||'No reference'}{x.notes?` · ${x.notes}`:''}</div></div><div className="flex min-w-0 flex-wrap items-center gap-3"><strong className="tabular-nums">{money(x.amount)}</strong>{x.reversed_at?<span className="text-xs text-muted-foreground">Reversed · {x.reversal_reason}</span>:x.bank_transaction_id?<span className="text-xs text-muted-foreground">Bank-linked · reversal unavailable</span>:<Accordion collapsible><AccordionItem value="reverse"><AccordionHeader>Reverse payment</AccordionHeader><AccordionPanel><ProcurementForm action={deleteTaxRemittance} className="grid gap-2"><input type="hidden" name="remittance_id" value={x.id}/><input type="hidden" name="expected_created_at" value={x.created_at}/><Label htmlFor={`reverse-tax-${x.id}`}>Reversal reason</Label><Input appearance="underline" id={`reverse-tax-${x.id}`} name="reversal_reason" required/><Button type="submit" appearance="outline" size="small">Confirm reversal</Button></ProcurementForm></AccordionPanel></AccordionItem></Accordion>}</div></div>)}</div>}
    </section>
  </div></>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
