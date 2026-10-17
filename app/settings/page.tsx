import {randomUUID} from 'node:crypto';
import {OperatingCalendarSettings} from '@/components/settings/OperatingCalendarSettings';
import {LaborConfigurationSettings} from '@/components/settings/LaborConfigurationSettings';
import {Badge,Button,Card,CardHeader,Field,Input,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import { BuildingRegular as Building2, CalculatorRegular as Calculator, DatabaseRegular as Database, BuildingBankRegular as Landmark, SignOutRegular as LogOut, MailRegular as Mail, SettingsRegular as Settings2 } from '@fluentui/react-icons';
import {AppShell} from '@/components/AppShell';
import {CompanyBrandingSettings} from '@/components/settings/CompanyBrandingSettings';
import {createClient} from '@/lib/supabase/server';
import {outlookConfigured} from '@/lib/outlook';
import {signOut} from './actions';
import {classifyLaborReadState} from './labor-read-state';
import {cn} from '@/lib/utils';

function IntegrationBadge({state}:{state:'connected'|'ready'|'needed'|'later'}){
  return <Badge appearance={state==='needed'?'filled':state==='connected'?'tint':'outline'} color={state==='needed'?'danger':'brand'} className={cn(state==='connected'&&'bg-success/10 text-success',state==='ready'&&'bg-primary/10 text-primary',state==='later'&&'text-muted-foreground')}>{state==='connected'?'Connected':state==='ready'?'Ready to connect':state==='needed'?'Setup needed':'Later'}</Badge>;
}

function SectionHeading({title,description}:{kicker:string;title:string;description:string}){
  return <div><h2 className="text-base font-semibold">{title}</h2><details className="pt-help"><summary>About this section</summary><p>{description}</p></details></div>;
}

export default async function SettingsPage({searchParams}:{searchParams:Promise<{tab?:string;taxYear?:string}>}){
  const requestedParams=await searchParams;
  const requestedTab=requestedParams.tab;
  const selectedTab=(['company','connections','system'] as const).find(tab=>tab===requestedTab)||'company';
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile,error}=await supabase.from('profiles').select('full_name,role,company_id').eq('id',user.id).maybeSingle();
  if(profile?.role==='employee')redirect('/employee');

  const calendarRead=profile?.company_id?await supabase.from('companies').select('operating_timezone').eq('id',profile.company_id).maybeSingle():{data:null,error:new Error('Company unavailable')};
  const calendarYear=Number(new Intl.DateTimeFormat('en-US',{year:'numeric',timeZone:calendarRead.data?.operating_timezone||'UTC'}).format(new Date()));
  const requestedYear=requestedParams.taxYear;
  const taxYear=requestedYear&&/^20\d{2}$|^2100$/.test(requestedYear)?Number(requestedYear):calendarYear;
  const [taxRead,riskRead,{data:outlook},{data:plaid},{data:branding},crewRead,openingRead]=profile?.company_id?await Promise.all([
    supabase.from('labor_tax_settings').select('*').eq('company_id',profile.company_id).eq('tax_year',taxYear).maybeSingle(),
    supabase.from('li_risk_classes').select('*').eq('company_id',profile.company_id).eq('tax_year',taxYear).order('code'),
    supabase.from('outlook_connections').select('mailbox_email,mailbox_name,status,last_sync_at,last_error,subscription_expires_at').eq('company_id',profile.company_id).maybeSingle(),
    supabase.from('plaid_connections').select('id,status,institution_name').eq('company_id',profile.company_id).eq('status','active'),
    supabase.from('company_branding').select('logo_path').eq('company_id',profile.company_id).maybeSingle(),
    supabase.from('crew_administration_summary').select('id,name,worker_type').eq('company_id',profile.company_id).order('name'),
    supabase.from('labor_tax_year_accounts').select('*').eq('company_id',profile.company_id).eq('tax_year',taxYear),
  ]):[{data:null,error:null},{data:null,error:null},{data:null},{data:[]},{data:null},{data:null,error:new Error('Company unavailable')},{data:null,error:new Error('Company unavailable')}];

  const tax=taxRead.data,risks=(riskRead.data||[]).filter(row=>row.active===true);
  const {taxStatus,riskStatus}=classifyLaborReadState({hasCompanyScope:Boolean(profile?.company_id),taxRead,riskRead:{...riskRead,data:riskRead.error?null:risks}});
  const name=profile?.full_name||user.email||'Identity unavailable',role=profile?.role||'Role unavailable',outlookReady=outlookConfigured(),outlookConnected=outlook?.status==='active';
  const cardSurface='rounded-md border border-border bg-card shadow-none';

  return <AppShell userName={name}>
    <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-col gap-3 lg:h-full">
      <header className="carez-page-heading"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">System</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1></header>

      <div className="min-h-0 flex-1 gap-0 border border-border bg-card">
        <div role="tablist" aria-label="Settings categories" className="w-full shrink-0 px-2">
          <Button as="a" href="?tab=company" role="tab" aria-selected={selectedTab==='company'} appearance={selectedTab==='company'?'primary':'subtle'} className="flex-none">Company</Button>
          <Button as="a" href="?tab=connections" role="tab" aria-selected={selectedTab==='connections'} appearance={selectedTab==='connections'?'primary':'subtle'} className="flex-none">Connections</Button>
          <Button as="a" href="?tab=system" role="tab" aria-selected={selectedTab==='system'} appearance={selectedTab==='system'?'primary':'subtle'} className="flex-none">System & labor</Button>
        </div>
      {selectedTab==='company'?<div className="min-h-0 overflow-auto p-4">
      {profile?.company_id?<section className="space-y-4">
        <SectionHeading kicker="Company" title="Branding" description="Company identity used by the PourTrace workspace and new commercial documents."/>
        <OperatingCalendarSettings requestId={randomUUID()} zone={calendarRead.data?.operating_timezone??null} available={!calendarRead.error&&!!calendarRead.data} canEdit={profile.role==='owner'}/><div className="rounded-md border border-border bg-card p-4"><CompanyBrandingSettings companyId={profile.company_id} initialLogoPath={branding?.logo_path||null}/></div>
      </section>:null}
      </div>:null}

      {selectedTab==='connections'?<div className="min-h-0 overflow-auto p-4">
      <section className="space-y-4">
        <SectionHeading kicker="Connections" title="Integrations" description="Services that remove office work or provide authoritative external data."/>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className={cardSurface}>
            <CardHeader image={<span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Mail className="size-4"/></span>} header={<div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Microsoft Outlook</h3><IntegrationBadge state={outlookConnected?'connected':outlookReady?'ready':'needed'}/></div>} description={<p className="text-xs leading-5 text-muted-foreground">Mailbox connection and lead intake.</p>}/>
            <div className="space-y-3">{outlookConnected?<dl className="divide-y rounded-lg border"><div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-xs"><dt className="text-muted-foreground">Mailbox</dt><dd className="truncate text-right font-medium">{outlook.mailbox_email||outlook.mailbox_name||'Connected'}</dd></div><div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-xs"><dt className="text-muted-foreground">Last scan</dt><dd className="text-right font-medium">{outlook.last_sync_at?new Date(outlook.last_sync_at).toLocaleString():'Not yet'}</dd></div></dl>:<p className="text-sm leading-5 text-muted-foreground">Microsoft app credentials must be configured once, then the mailbox is authorized through Microsoft sign-in.</p>}{outlook?.last_error?<div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-5 text-warning">{outlook.last_error}</div>:null}<Link className={primaryLinkClass} href="/opportunities?view=intake">{outlookConnected?'Open lead inbox':'Set up Outlook'}</Link></div>
          </Card>

          <Card className={cardSurface}>
            <CardHeader image={<span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Landmark className="size-4"/></span>} header={<div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Banking / Plaid</h3><IntegrationBadge state={(plaid||[]).length?'connected':'later'}/></div>} description={<p className="text-xs leading-5 text-muted-foreground">Banking controls are unavailable in Financials.</p>}/>
            <div className="space-y-3"><p className="text-sm leading-5 text-muted-foreground">{(plaid||[]).length?`${(plaid||[]).length} existing connection${(plaid||[]).length===1?'':'s'}${plaid?.[0]?.institution_name?` · ${plaid[0].institution_name}`:''}. Banking controls are not connected to the current Financials workspace.`:'Banking controls are not connected to the current Financials workspace.'}</p></div>
          </Card>

          <Card className={cardSurface}>
            <CardHeader image={<span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Calculator className="size-4"/></span>} header={<div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">QuickBooks</h3><IntegrationBadge state="later"/></div>} description={<p className="text-xs leading-5 text-muted-foreground">Accounting integration status.</p>}/>
          </Card>
        </div>
      </section>
      </div>:null}

      {selectedTab==='system'?<div className="min-h-0 overflow-auto p-4">
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2"><input type="hidden" name="tab" value="system"/><Field label="Labor tax year"><Input name="taxYear" type="number" min="2000" max="2100" step="1" defaultValue={String(taxYear)} required/></Field><Button type="submit" appearance="outline">View year</Button></form>
      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <div className="space-y-4">
          <Card className={cardSurface}><CardHeader image={<span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Database className="size-4"/></span>} header={<div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Database & login</h3><IntegrationBadge state={!error&&profile?'connected':'needed'}/></div>} description={<p className="text-xs leading-5 text-muted-foreground">Company database and account access.</p>}/></Card>

          <Card className={cardSurface}><CardHeader image={<Building2 className="size-4 text-primary"/>} header={<h3 className="text-sm font-semibold">Company overhead</h3>} description={<p className="text-xs leading-5 text-muted-foreground">Company plan and recurring costs.</p>}/><div><Link className={secondaryLinkClass} href="/overhead">Open overhead</Link></div></Card>

          <Card className={cardSurface}><CardHeader image={<Settings2 className="size-4 text-primary"/>} header={<h3 className="text-sm font-semibold">Signed in</h3>} description={<p className="break-words text-xs leading-5 text-muted-foreground">{name} · {role}</p>}/><div><form action={signOut}><Button type="submit" appearance="outline"><LogOut/>Log out</Button></form></div></Card>
        </div>

        <Card className={`${cardSurface} gap-0 py-0`}>
          <CardHeader className="border-b py-4" header={<h3 className="text-sm font-semibold">{taxYear} labor settings</h3>} description={<p className="text-xs leading-5 text-muted-foreground">Timecards snapshot employer payroll taxes, L&I work-class cost, and sick-leave reserve.</p>}/>
          <div className="space-y-4 p-4">
            {taxStatus==='unavailable'?<div role="status" className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm"><strong>Unavailable</strong><span className="text-muted-foreground"> · {taxYear} tax settings could not be read.</span></div>:
              taxStatus==='missing'?<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{taxYear} tax settings missing.</div>:
              tax?<div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Employer Social Security</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.social_security_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Employer Medicare</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.medicare_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">WA SUI / EAF</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.wa_sui_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">FUTA while applicable</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.futa_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2"><div className="text-xs text-muted-foreground">Sick leave reserve</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{Number(tax.sick_leave_accrual_rate).toLocaleString(undefined,{maximumFractionDigits:6})} hr / hr</div></div></div>:null}

            <div><div className="mb-2 text-xs font-semibold text-muted-foreground">Active L&I risk classes</div>{riskStatus==='unavailable'?<div role="status" className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm"><strong>Unavailable</strong><span className="text-muted-foreground"> · Active {taxYear} L&I risk classes could not be read.</span></div>:riskStatus==='empty'?<div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">No active {taxYear} L&I risk classes are recorded. Add or activate a class before relying on L&I rates for labor review.</div>:<div className="rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHeaderCell>Class</TableHeaderCell><TableHeaderCell>Description</TableHeaderCell><TableHeaderCell className="text-right">Employer rate / hr</TableHeaderCell></TableRow></TableHeader><TableBody>{(risks||[]).map(r=><TableRow key={r.code}><TableCell className="font-mono text-xs font-semibold">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right font-mono tabular-nums">${Number(r.employer_rate_per_hour).toFixed(5)}</TableCell></TableRow>)}</TableBody></Table></div>}</div>
          </div>
        </Card>
      </div>
      {profile?.company_id&&['owner','office'].includes(profile.role)?<div className="mt-4"><LaborConfigurationSettings year={taxYear} tax={tax} taxAvailable={!taxRead.error} risks={riskRead.data||[]} riskAvailable={!riskRead.error&&Array.isArray(riskRead.data)} crew={crewRead.data||[]} crewAvailable={!crewRead.error&&Array.isArray(crewRead.data)} openings={openingRead.data||[]} openingAvailable={!openingRead.error&&Array.isArray(openingRead.data)} ids={{tax:randomUUID(),risk:randomUUID(),opening:randomUUID()}}/></div>:null}
      </div>:null}
      </div>
    </div>
  </AppShell>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
