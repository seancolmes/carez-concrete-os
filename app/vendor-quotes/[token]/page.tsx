import {notFound} from 'next/navigation';
import {VendorPriceForm} from '@/components/opportunities/VendorPriceForm';
import {createClient} from '@/lib/supabase/server';
import {Badge,Card,FluentProvider,webLightTheme} from '@fluentui/react-components';

export const metadata={robots:{index:false,follow:false}};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VendorBrief={supplier_name:string;quote_number:string|null;quote_set:string;scope_note:string|null;estimate_name:string;expires_at:string;editable:boolean;outputs:{id:string;label:string|null;quantity:number|string|null;unit:string|null;unit_cost:number|null;source_reference:string|null}[]};

export default async function SupplierQuotePage({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  if(!uuid.test(token))notFound();
  const supabase=await createClient();
  const {data,error}=await supabase.rpc('carez_get_public_vendor_quote',{p_token:token});
  if(error||!data)notFound();
  const brief=data as VendorBrief;
  return <FluentProvider theme={webLightTheme}><main className="min-h-screen bg-[#F5F7F6] px-4 py-8 text-[#1C2721] sm:py-14"><div className="mx-auto max-w-4xl space-y-6">
    <header className="border-b border-[#D9DFDB] pb-5"><p className="font-mono text-xs uppercase tracking-[.18em] text-[#59675F]">Carez · Vendor Quotes</p><h1 className="mt-2 text-2xl font-semibold">{brief.quote_set}</h1><p className="mt-1 text-sm text-[#59675F]">{brief.estimate_name}</p></header>
    <section className="grid gap-px overflow-hidden rounded-lg border border-[#D9DFDB] bg-[#D9DFDB] sm:grid-cols-3" aria-label="Quote details">
      <Fact label="Supplier" value={brief.supplier_name}/><Fact label="Quote reference" value={brief.quote_number||'Pending'}/><Fact label="Link expires" value={new Date(brief.expires_at).toLocaleDateString('en-US',{timeZone:'UTC'})}/>
    </section>
    {brief.scope_note?<p className="rounded-lg border border-[#D9DFDB] bg-white px-4 py-3 text-sm text-[#36443C]">{brief.scope_note}</p>:null}
    <section className="space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-semibold">Unit pricing</h2><p className="mt-1 text-sm text-[#59675F]">Enter your price per listed unit. Carez will review your response before using it in the estimate.</p></div><Badge appearance="tint" color={brief.editable?'success':'warning'}>{brief.editable?'Open for pricing':'Closed'}</Badge></div>
      {!brief.editable?<p role="status" className="rounded-lg border border-[#D9B979] bg-[#FFF6E4] px-4 py-3 text-sm text-[#674616]">This quote request is closed for changes. Your recorded prices remain visible below.</p>:null}
      {brief.outputs.length===0?<p className="rounded-lg border border-[#D9DFDB] bg-white px-4 py-8 text-sm text-[#59675F]">No takeoff resources are ready for supplier pricing yet.</p>:<div className="space-y-2">{brief.outputs.map(output=><Card key={output.id} appearance="outline" className="border-[#D9DFDB] bg-white p-4 [&_label]:!text-[#4F5C55] [&_[role=alert]]:!text-[#A63131] [&_[role=status]]:!text-[#286647]"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-medium">{output.label||'Concrete resource'}</h3><span className="font-mono text-xs tabular-nums text-[#59675F]">{Number(output.quantity||0).toLocaleString('en-US')} {output.unit||''}</span></div>{brief.editable?<VendorPriceForm token={token} output={output}/>:<p className="font-mono text-sm text-[#36443C]">{output.unit_cost==null?'No price entered':`${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(output.unit_cost))}/${output.unit||'unit'}`}</p>}</Card>)}</div>}
    </section>
    <p className="border-t border-[#D9DFDB] pt-4 text-xs text-[#59675F]">This link is private to your company. Pricing submitted here is evidence for Carez review and does not award work or change the customer proposal.</p>
  </div></main></FluentProvider>;
}

function Fact({label,value}:{label:string;value:string}){return <div className="bg-white px-4 py-3"><p className="font-mono text-[10px] uppercase tracking-wider text-[#59675F]">{label}</p><p className="mt-1 text-sm font-medium text-[#1C2721]">{value}</p></div>;}
