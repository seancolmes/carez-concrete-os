import Link from 'next/link';

export type OpportunityDetail='scope'|'plans'|'estimates'|'proposals';

const sections:[OpportunityDetail,string][]=[['scope','Scope'],['plans','Plans & takeoff'],['estimates','Estimate revisions'],['proposals','Issued proposals']];

export function OpportunitySectionNav({active,leadId,estimateId}:{active:OpportunityDetail;leadId:string;estimateId?:string|null}){
  const base=new URLSearchParams({lead:leadId,section:'scope'});
  if(estimateId)base.set('estimate',estimateId);
  return <nav aria-label="Opportunity record views" className="flex w-full items-center gap-1 overflow-x-auto border-b border-border pb-2">
    {sections.map(([id,label])=>{
      const params=new URLSearchParams(base);
      params.set('detail',id);
      return <Link key={id} href={`/opportunities?${params.toString()}`} aria-current={active===id?'page':undefined} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${active===id?'bg-accent text-foreground':'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}`}>{label}</Link>;
    })}
  </nav>;
}
