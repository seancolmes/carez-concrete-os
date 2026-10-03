import {notFound} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {TodaySurface,type TodaySurfaceProps} from '@/components/today/TodaySurface';

const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateAfter=(start:string,offset:number)=>{const date=new Date(`${start}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
const shortDate=(date:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));

export default function DashboardDemoPage(){
  if(process.env.NODE_ENV!=='development')notFound();

  const start=localDate();
  const now=new Date();
  const pours:TodaySurfaceProps['scheduleItems']=[
    {id:'sample-pour-1',projectId:null,date:dateAfter(start,0),day:shortDate(dateAfter(start,0)),time:'6:00 AM',sortTime:'06:00',project:'2417 · Northgate Medical',title:'Level 2 slab',type:'pour',status:'hold',yards:86,crewNeeded:8,href:'/field?view=schedule',location:'Sacramento, CA',forecast:{high:77,low:54,precipitation:5,condition:'Clear'},readiness:{status:'hold',inspectionClear:1,inspectionCount:2,nextAction:'Embed inspection remains open.'}},
    {id:'sample-pour-2',projectId:null,date:dateAfter(start,2),day:shortDate(dateAfter(start,2)),time:'7:30 AM',sortTime:'07:30',project:'2409 · Riverfront Garage',title:'Parking deck phase B',type:'pour',status:'planned',yards:124,crewNeeded:10,href:'/field?view=schedule',location:'West Sacramento, CA',forecast:{high:73,low:51,precipitation:10,condition:'Cloudy'},readiness:{status:'ready',inspectionClear:2,inspectionCount:2,nextAction:null}},
    {id:'sample-pour-3',projectId:null,date:dateAfter(start,4),day:shortDate(dateAfter(start,4)),time:'5:30 AM',sortTime:'05:30',project:'2421 · Valley Storage',title:'South foundations',type:'pour',status:'planned',yards:68,crewNeeded:6,href:'/field?view=schedule',location:'Elk Grove, CA',forecast:{high:79,low:56,precipitation:0,condition:'Clear'}},
    {id:'sample-pour-4',projectId:null,date:dateAfter(start,8),day:shortDate(dateAfter(start,8)),time:'Time pending',sortTime:'99:99',project:'2417 · Northgate Medical',title:'Site paving',type:'pour',status:'planned',yards:112,crewNeeded:7,href:'/field?view=schedule',location:'Sacramento, CA',forecast:null},
  ];
  const plannedYards=[40,110,0,110,95,80,0];
  const fieldSeries=[42,86,0,128,94,78,0].map((yards,index)=>{const date=dateAfter(start,index-6);return {date,label:shortDate(date),yards,plannedYards:plannedYards[index]};});
  const props:TodaySurfaceProps={
    date:new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${start}T12:00:00Z`)),
    dateISO:start,
    refreshedAt:now.toISOString(),
    refreshedLabel:new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(now),
    weekEnd:shortDate(dateAfter(start,6)),
    outlookEnd:shortDate(dateAfter(start,13)),
    attention:[
      {tone:'danger',category:'Inspection hold',subject:'2417 · Northgate Medical',issue:'Level 2 slab inspection hold is recorded.',when:'Today · 6:00 AM',href:'/field?view=readiness',action:'Review hold',urgent:true},
      {tone:'warning',category:'Change order',subject:'CO-014 · Riverfront Garage',issue:'Added equipment pad awaits approval.',when:'3 days awaiting',href:'/change-orders',action:'Review change order',urgent:true,facts:[{label:'Amount',value:'$8,420'},{label:'Status',value:'Submitted'},{label:'Scope',value:'Equipment pad / site concrete'},{label:'Project',value:'Riverfront Garage'}]},
      {tone:'info',category:'Billing review',subject:'Valley Storage billing',issue:'Completed work is ready for the October draw.',when:'Due today',href:'/financials?tab=billing&view=billing',action:'Review billing'},
      {tone:'warning',category:'Concrete order',subject:'2417 · Northgate Medical',issue:'Concrete order confirmation is still open.',when:'Before next pour',href:'/field?view=schedule',action:'Review pour'},
      {tone:'info',category:'Proposal follow-up',subject:'Central Warehouse proposal',issue:'Customer follow-up is due this week.',when:'Friday',href:'/opportunities',action:'Open proposal'},
    ],
    attentionUnavailable:false,
    scheduleItems:pours,
    scheduleUnavailable:false,
    pourDataUnavailable:false,
    planningJobs:[],
    operationalMetrics:[
      {label:'Bids due / 7D',value:'2',detail:'Open opportunities',href:'/opportunities'},
      {label:'Active jobs',value:'3',detail:'$3.82M contract',href:'/projects'},
      {label:'Concrete / 7D',value:'278 CY',detail:'3 pour windows',href:'/field?view=schedule'},
      {label:'Open CO exposure',value:'$18,420',detail:'3 open · 1 submitted',href:'/change-orders'},
      {label:'Earned / unbilled',value:'—',detail:'Billing progress unavailable',href:'/financials?tab=billing&view=billing'},
      {label:'A/R overdue',value:'$18,400',detail:'Past due customer balance',tooltip:'$76,240 total A/R',href:'/financials?tab=billing&view=billing'},
    ],
    activeJobs:[
      {id:'sample-job-1',number:'2417',name:'Northgate Medical',customer:'Northgate Builders',location:'Sacramento, CA',nextPour:`${shortDate(dateAfter(start,0))} · Level 2 slab`,nextPourDate:dateAfter(start,0),contract:'$1,820,000',contractValue:1820000,billing:'$624,000',billedPercent:624000/1820000*100,coExposure:'$8,420',coExposureValue:8420,status:'hold'},
      {id:'sample-job-2',number:'2409',name:'Riverfront Garage',customer:'Riverfront Construction',location:'West Sacramento, CA',nextPour:`${shortDate(dateAfter(start,2))} · Parking deck phase B`,nextPourDate:dateAfter(start,2),contract:'$1,240,000',contractValue:1240000,billing:'$418,000',billedPercent:418000/1240000*100,coExposure:'$10,000',coExposureValue:10000,status:'ready'},
      {id:'sample-job-3',number:'2421',name:'Valley Storage',customer:'Valley Development',location:'Elk Grove, CA',nextPour:`${shortDate(dateAfter(start,4))} · South foundations`,nextPourDate:dateAfter(start,4),contract:'$760,000',contractValue:760000,billing:'$176,000',billedPercent:176000/760000*100,coExposure:'$0',coExposureValue:0,status:'planning'},
    ],
    fieldMetrics:[
      {label:'Concrete placed',value:'428 CY',detail:'Recorded in daily logs',href:'/field?view=production'},
      {label:'Crew hours',value:'312 hrs',detail:'Recorded timecards',href:'/field?view=time-review'},
      {label:'Pour windows',value:'7',detail:'Scheduled in last 7 days',href:'/field?view=deliveries'},
      {label:'Exceptions',value:'2',detail:'Daily logs needing review',href:'/field?view=production'},
    ],
    fieldSeries,
    bidQueue:[{title:'Central Warehouse · Proposal 321',due:shortDate(dateAfter(start,2)),href:'/opportunities'},{title:'Airport Utilities · Proposal 326',due:shortDate(dateAfter(start,5)),href:'/opportunities'}],
    bidDueQueue:[{title:'Central Warehouse · bid',due:shortDate(dateAfter(start,2)),href:'/opportunities'},{title:'Airport Utilities · bid',due:shortDate(dateAfter(start,5)),href:'/opportunities'}],
    pipelineSummary:{count:6,value:'$1.24M',bidsDue:2,dueThisWeek:2,unavailable:false},
    commercialMetrics:[
      {label:'Earned / unbilled',value:'—',detail:'Billing progress unavailable',href:'/financials?tab=billing&view=billing'},
      {label:'A/R outstanding',value:'$76,240',detail:'$18,400 overdue',href:'/financials?tab=billing&view=billing'},
      {label:'Open CO exposure',value:'$18,420',detail:'3 submitted',href:'/change-orders'},
      {label:'Retainage held',value:'$31,600',detail:'4 projects · unreleased',href:'/financials?tab=billing&view=billing'},
      {label:'Contract backlog',value:'$2.60M',detail:'Active unbilled contract',href:'/financials?tab=billing&view=billing'},
      {label:'A/R overdue',value:'$18,400',detail:'Past due customer balance',href:'/financials?tab=billing&view=billing'},
    ],
    commercialAction:{title:'CO-014 awaiting approval',detail:'Riverfront Garage · $8,420 open change order.',href:'/change-orders',label:'Review change order'},
    preview:true,
  };

  return <AppShell userName="Sample Preview"><TodaySurface {...props}/></AppShell>;
}
