import {redirect} from 'next/navigation';
import Link from 'next/link';
import {Building2,Calculator,Database,Landmark,LogOut,Mail,Settings2} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {AppearanceSettings} from '@/components/settings/AppearanceSettings';
import {CompanyBrandingSettings} from '@/components/settings/CompanyBrandingSettings';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {createClient} from '@/lib/supabase/server';
import {outlookConfigured} from '@/lib/outlook';
import {signOut} from './actions';
import {cn} from '@/lib/utils';

function IntegrationBadge({state}:{state:'connected'|'ready'|'needed'|'later'}){
  return <Badge variant={state==='needed'?'destructive':state==='connected'?'secondary':'outline'} className={cn(state==='connected'&&'bg-success/10 text-success',state==='ready'&&'bg-primary/10 text-primary',state==='later'&&'text-muted-foreground')}>{state==='connected'?'Connected':state==='ready'?'Ready to connect':state==='needed'?'Setup needed':'Later'}</Badge>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description:string}){
  return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p></div>;
}

export default async function SettingsPage(){
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

  return <AppShell userName={name}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="carez-page-heading"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">System</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1></header>

      {profile?.company_id?<section className="space-y-4">
        <SectionHeading kicker="Company" title="Branding" description="Company identity used by the Carez workspace and new commercial documents."/>
        <CompanyBrandingSettings companyId={profile.company_id} initialLogoPath={branding?.logo_path||null}/>
      </section>:null}

      <section className="space-y-4">
        <SectionHeading kicker="Interface" title="Appearance" description="Theme and baseline workspace density for this device."/>
        <AppearanceSettings />
      </section>

      <section className="space-y-4">
        <SectionHeading kicker="Connections" title="Integrations" description="Services that remove office work or provide authoritative external data."/>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="shadow-none">
            <CardHeader className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Mail className="size-4"/></span><div><CardTitle>Microsoft Outlook</CardTitle><CardDescription className="mt-1">Identify concrete opportunities and route uncertain messages into Lead Inbox.</CardDescription></div><IntegrationBadge state={outlookConnected?'connected':outlookReady?'ready':'needed'}/></CardHeader>
            <CardContent className="space-y-3">{outlookConnected?<dl className="divide-y rounded-lg border"><div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-xs"><dt className="text-muted-foreground">Mailbox</dt><dd className="truncate text-right font-medium">{outlook.mailbox_email||outlook.mailbox_name||'Connected'}</dd></div><div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-xs"><dt className="text-muted-foreground">Last scan</dt><dd className="text-right font-medium">{outlook.last_sync_at?new Date(outlook.last_sync_at).toLocaleString():'Not yet'}</dd></div></dl>:<p className="text-sm leading-5 text-muted-foreground">Microsoft app credentials must be configured once, then the mailbox is authorized through Microsoft sign-in.</p>}{outlook?.last_error?<div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-5 text-warning">{outlook.last_error}</div>:null}<Link className={buttonVariants({size:'sm'})} href="/leads/inbox">{outlookConnected?'Open lead inbox':'Set up Outlook'}</Link></CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Landmark className="size-4"/></span><div><CardTitle>Banking / Plaid</CardTitle><CardDescription className="mt-1">Bank balances and transactions used by cash, reconciliation, and bank rules.</CardDescription></div><IntegrationBadge state={(plaid||[]).length?'connected':'needed'}/></CardHeader>
            <CardContent className="space-y-3"><p className="text-sm leading-5 text-muted-foreground">{(plaid||[]).length?`${(plaid||[]).length} active connection${(plaid||[]).length===1?'':'s'}${plaid?.[0]?.institution_name?` · ${plaid[0].institution_name}`:''}`:'Connect through Banking.'}</p><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/banking">Open banking</Link></CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Calculator className="size-4"/></span><div><CardTitle>QuickBooks</CardTitle><CardDescription className="mt-1">Accounting export/integration after the Carez operating workflow is stable.</CardDescription></div><IntegrationBadge state="later"/></CardHeader>
          </Card>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <div className="space-y-4">
          <Card className="shadow-none"><CardHeader className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Database className="size-4"/></span><div><CardTitle>Database & login</CardTitle><CardDescription className="mt-1">Supabase live company database and private Carez authentication.</CardDescription></div><IntegrationBadge state={!error&&profile?'connected':'needed'}/></CardHeader></Card>

          <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-4 text-primary"/>Cost to keep Carez running</CardTitle><CardDescription>Owner compensation, capacity, fleet, and recurring company cost.</CardDescription></CardHeader><CardContent><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/overhead">Open overhead</Link></CardContent></Card>

          <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="size-4 text-primary"/>Signed in</CardTitle><CardDescription>{name} · {profile?.role||'owner'}</CardDescription></CardHeader><CardContent><form action={signOut}><Button type="submit" variant="outline"><LogOut/>Log out</Button></form></CardContent></Card>
        </div>

        <Card className="gap-0 py-0 shadow-none">
          <CardHeader className="border-b py-4"><CardTitle>2026 labor engine</CardTitle><CardDescription>Timecards snapshot employer payroll taxes, L&I work-class cost, and sick-leave reserve.</CardDescription></CardHeader>
          <CardContent className="space-y-4 p-4">
            {tax?<div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Employer Social Security</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.social_security_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Employer Medicare</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.medicare_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">WA SUI / EAF</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.wa_sui_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">FUTA while applicable</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{(Number(tax.futa_rate)*100).toFixed(2)}%</div></div><div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2"><div className="text-xs text-muted-foreground">Sick leave reserve</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">1 hr / 40 hr</div></div></div>:<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">2026 tax settings missing.</div>}

            <div><div className="mb-2 text-xs font-semibold text-muted-foreground">Active L&I risk classes</div><div className="rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead>Class</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Employer rate / hr</TableHead></TableRow></TableHeader><TableBody>{(risks||[]).map(r=><TableRow key={r.code}><TableCell className="font-mono text-xs font-semibold">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right font-mono tabular-nums">${Number(r.employer_rate_per_hour).toFixed(5)}</TableCell></TableRow>)}</TableBody></Table></div></div>
          </CardContent>
        </Card>
      </div>
    </div>
  </AppShell>;
}
