import {Badge,Button,Card,CardHeader,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import { BuildingRegular as Building2, CalculatorRegular as Calculator, DatabaseRegular as Database, BuildingBankRegular as Landmark, SignOutRegular as LogOut, MailRegular as Mail, SettingsRegular as Settings2 } from '@fluentui/react-icons';
import {AppShell} from '@/components/AppShell';
import {AppearanceSettings} from '@/components/settings/AppearanceSettings';
import {CompanyBrandingSettings} from '@/components/settings/CompanyBrandingSettings';
import {createClient} from '@/lib/supabase/server';
import {outlookConfigured} from '@/lib/outlook';
import {signOut} from './actions';
import {cn} from '@/lib/utils';

function IntegrationBadge({state}:{state:'connected'|'ready'|'needed'|'later'}){
  return <Badge appearance={state==='needed'?'filled':state==='connected'?'tint':'outline'} color={state==='needed'?'danger':'brand'} className={cn(state==='connected'&&'bg-success/10 text-success',state==='ready'&&'bg-primary/10 text-primary',state==='later'&&'text-muted-foreground')}>{state==='connected'?'Connected':state==='ready'?'Ready to connect':state==='needed'?'Setup needed':'Later'}</Badge>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description:string}){
  return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p></div>;
}

export default async function SettingsPage({searchParams}:{searchParams:Promise<{tab?:string}>}){
  const requestedTab=(await searchParams).tab;
  const selectedTab=(['appearance','company','connections','system'] as const).find(tab=>tab===requestedTab)||'appearance';
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile,error}=await supabase.from('profiles').select('full_name,role,company_id').eq('id',user.id).maybeSingle();
  if(profile?.role==='employee')redirect('/employee');

  const [{data:tax},{data:risks},{data:outlook},{data:plaid},{data:branding}]=profile?.company_id?await Promise.all([
    supabase.from('labor_tax_settings').select('*').eq('company_id',profile.company_id).eq('tax_year',2026).maybeSingle(),
    supabase.from('li_risk_classes').select('code,name,employer_rate_per_hour').eq('company_id',profile.company_id).eq('tax_year',2026).eq('active',true).order('code'),
    supabase.from('outlook_connections').select('mailbox_email,mailbox_name,status,last_sync_at,last_error,subscription_expires_at').eq('company_id',profile.company_id).maybeSingle(),
    supabase.from('plaid_connections').select('id,status,institution_name').eq('company_id',profile.company_id).eq('status','active'),
    supabase.from('company_branding').select('logo_path').eq('company_id',profile.company_id).maybeSingle(),
  ]):[{data:null},{data:[]},{data:null},{data:[]},{data:null}];

  const name=profile?.full_name||user.email||'Owner',outlookReady=outlookConfigured(),outlookConnected=outlook?.status==='active';
  const cardSurface='rounded-md border border-border bg-card shadow-[inset_0_1px_rgba(255,255,255,0.04)]';

  return <AppShell userName={name}>
    <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-col gap-3 lg:h-full">
      <header className="carez-page-heading"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">System</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1></header>

      <div className="min-h-0 flex-1 gap-0 border border-border bg-card">
        <div role="tablist" aria-label="Settings categories" className="w-full shrink-0 px-2">
          <Button as="a" href="?tab=appearance" role="tab" aria-selected={selectedTab==='appearance'} appearance={selectedTab==='appearance'?'primary':'subtle'} className="flex-none">Appearance</Button>
          <Button as="a" href="?tab=company" role="tab" aria-selected={selectedTab==='company'} appearance={selectedTab==='company'?'primary':'subtle'} className="flex-none">Company</Button>
          <Button as="a" href="?tab=connections" role="tab" aria-selected={selectedTab==='connections'} appearance={selectedTab==='connections'?'primary':'subtle'} className="flex-none">Connections</Button>
          <Button as="a" href="?tab=system" role="tab" aria-selected={selectedTab==='system'} appearance={selectedTab==='system'?'primary':'subtle'} className="flex-none">System & labor</Button>
        </div>
      {selectedTab==='company'?<div className="min-h-0 overflow-auto p-4">
      {profile?.company_id?<section className="space-y-4">
        <SectionHeading kicker="Company" title="Branding" description="Company identity used by the Carez workspace and new commercial documents."/>
        <div className="rounded-md border border-border bg-card p-4"><CompanyBrandingSettings companyId={profile.company_id} initialLogoPath={branding?.logo_path||null}/></div>
      </section>:null}
      </div>:null}

      {selectedTab==='appearance'?<div className="min-h-0 overflow-auto p-4">
      <section className="space-y-4">
        <SectionHeading kicker="Interface" title="Appearance" description="Choose the workspace theme that fits your environment."/>
        <AppearanceSettings />
      </section>
      </div>:null}

      {selectedTab==='connections'?<div className="min-h-0 overflow-auto p-4">
      <section className="space-y-4">
        <SectionHeading kicker="Connections" title="Integrations" description="Services that remove office work or provide authoritative external data."/>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className={cardSurface}>
            <CardHeader className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Mail className="size-4"/></span><div><h3>Microsoft Outlook</h3><p className="mt-1">Identify concrete opportunities and route uncertain messages into Lead Inbox.</p></div><IntegrationBadge state={outlookConnected?'connected':outlookReady?'ready':'needed'}/></CardHeader>
            <div className="space-y-3">{outlookConnected?<dl className="divide-y rounded-lg border"><div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-xs"><dt className="text-muted-foreground">Mailbox</dt><dd className="truncate text-right font-medium">{outlook.mailbox_email||outlook.mailbox_name||'Connected'}</dd></div><div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-xs"><dt className="text-muted-foreground">Last scan</dt><dd className="text-right font-medium">{outlook.last_sync_at?new Date(outlook.last_sync_at).toLocaleString():'Not yet'}</dd></div></dl>:<p className="text-sm leading-5 text-muted-foreground">Microsoft app credentials must be configured once, then the mailbox is authorized through Microsoft sign-in.</p>}{outlook?.last_error?<div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-5 text-warning">{outlook.last_error}</div>:null}<Link className={primaryLinkClass} href="/opportunities?view=intake">{outlookConnected?'Open lead inbox':'Set up Outlook'}</Link></div>
          </Card>

          <Card className={cardSurface}>
            <CardHeader className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Landmark className="size-4"/></span><div><h3>Banking / Plaid</h3><p className="mt-1">Connection status only. Banking controls are not connected to the current Financials workspace.</p></div><IntegrationBadge state={(plaid||[]).length?'connected':'later'}/></CardHeader>
            <div className="space-y-3"><p className="text-sm leading-5 text-muted-foreground">{(plaid||[]).length?`${(plaid||[]).length} existing connection${(plaid||[]).length===1?'':'s'}${plaid?.[0]?.institution_name?` · ${plaid[0].institution_name}`:''}. Banking controls are not connected to the current Financials workspace.`:'Banking controls are not connected to the current Financials workspace.'}</p></div>
          </Card>

          <Card className={cardSurface}>
            <CardHeader className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Calculator className="size-4"/></span><div><h3>QuickBooks</h3><p className="mt-1">Accounting export/integration after the Carez operating workflow is stable.</p></div><IntegrationBadge state="later"/></CardHeader>
          </Card>
        </div>
      </section>
      </div>:null}

      {selectedTab==='system'?<div className="min-h-0 overflow-auto p-4">
      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <div className="space-y-4">
          <Card className={cardSurface}><CardHeader className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Database className="size-4"/></span><div><h3>Database & login</h3><p className="mt-1">Supabase live company database and private Carez authentication.</p></div><IntegrationBadge state={!error&&profile?'connected':'needed'}/></CardHeader></Card>

          <Card className={cardSurface}><CardHeader><h3 className="flex items-center gap-2"><Building2 className="size-4 text-primary"/>Cost to keep Carez running</h3><p>Owner compensation, capacity, fleet, and recurring company cost.</p></CardHeader><div><Link className={secondaryLinkClass} href="/overhead">Open overhead</Link></div></Card>

          <Card className={cardSurface}><CardHeader><h3 className="flex items-center gap-2"><Settings2 className="size-4 text-primary"/>Signed in</h3><p>{name} · {profile?.role||'owner'}</p></CardHeader><div><form action={signOut}><Button type="submit" appearance="outline"><LogOut/>Log out</Button></form></div></Card>
        </div>

        <Card className={`${cardSurface} gap-0 py-0`}>
          <CardHeader className="border-b py-4"><h3>2026 labor engine</h3><p>Timecards snapshot employer payroll taxes, L&I work-class cost, and sick-leave reserve.</p></CardHeader>
          <div className="space-y-4 p-4">
            {tax?<div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Employer Social Security</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.social_security_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Employer Medicare</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.medicare_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">WA SUI / EAF</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.wa_sui_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">FUTA while applicable</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.futa_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2"><div className="text-xs text-muted-foreground">Sick leave reserve</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">1 hr / 40 hr</div></div></div>:<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">2026 tax settings missing.</div>}

            <div><div className="mb-2 text-xs font-semibold text-muted-foreground">Active L&I risk classes</div><div className="rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHeaderCell>Class</TableHeaderCell><TableHeaderCell>Description</TableHeaderCell><TableHeaderCell className="text-right">Employer rate / hr</TableHeaderCell></TableRow></TableHeader><TableBody>{(risks||[]).map(r=><TableRow key={r.code}><TableCell className="font-mono text-xs font-semibold">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right font-mono tabular-nums">${Number(r.employer_rate_per_hour).toFixed(5)}</TableCell></TableRow>)}</TableBody></Table></div></div>
          </div>
        </Card>
      </div>
      </div>:null}
      </div>
    </div>
  </AppShell>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
