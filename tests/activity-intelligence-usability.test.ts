import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {renderActivity,renderIntelligence} from './fixtures/intelligence-render.ts';
import {intelligenceReadNames,type IntelligenceReads} from '../components/opportunities/views/intelligence-read-state.ts';

const reads=():IntelligenceReads=>Object.fromEntries(intelligenceReadNames.map(name=>[name,{data:[],error:null}])) as unknown as IntelligenceReads;
const lead={id:'local-lead',status:'estimating',follow_up:'2026-10-20'};

test('activity history precedes secondary forms, with collapsed disclosures and retained note labels',()=>{
  const {html}=renderActivity(lead,[{id:'local-activity',activity_type:'note',note:'Known history retained',activity_date:'2026-10-15',created_at:'2026-10-15'}]);
  assert.ok(html.indexOf('Known history retained')<html.indexOf('Change pipeline stage'));
  for(const action of ['Change pipeline stage','Set follow-up date','Record activity'])assert.ok(html.includes(action));
  assert.doesNotMatch(html,/aria-expanded="true"/);
  assert.match(html,/for="activity-type"/);
  assert.match(html,/for="activity-note"/);
  assert.match(html,/id="activity-note"/);
});

test('intelligence records precede creation and all secondary disclosures start closed',()=>{
  const data=reads();
  data.leads.data=[{id:'local-lead',customer_name:'Local customer',project_name:'Known job'}];
  data.profiles.data=[{lead_id:'local-lead',carez_pursuit_score:75,carez_recommendation:'review',customer_budget:0}];
  data.guardrails.data=[{estimate_id:'local-estimate',name:'Known guardrail',selected_sell_price:100000}];
  data.feedback.data=[{id:'local-feedback',competitor_name:'Known feedback',competitor_price:95000}];
  data.options.data=[{id:'local-option',name:'Known alternate',status:'suggested',base_sell_price:100000,option_sell_price:98000}];
  const {html}=renderIntelligence(data);
  assert.ok(html.indexOf('75/100')<html.indexOf('Update Pursuit Score'));
  assert.ok(html.indexOf('Known feedback')<html.indexOf('Record market feedback'));
  assert.ok(html.indexOf('Known alternate')<html.indexOf('Add value option'));
  assert.doesNotMatch(html,/aria-expanded="true"/);
  assert.match(html,/Company-wide intelligence/);
  assert.match(html,/href="\/opportunities"[^>]*>Open bid pipeline/);
  assert.match(html,/aria-label="Status for Known alternate"/);
});

test('failed schema-backed creation reads do not expose executable creation forms',()=>{
  const data=reads();
  data.feedback={data:null,error:{code:'PGRST205',message:'Missing local fixture relation'}};
  data.options={data:null,error:{code:'PGRST205',message:'Missing local fixture relation'}};
  const {html}=renderIntelligence(data);
  assert.match(html,/Competitor feedback/);
  assert.match(html,/Value options/);
  assert.doesNotMatch(html,/Record market feedback<|Add value option<|name="competitor_name"|name="customer_description"/);
});

test('Intelligence labels use stable unique IDs scoped to their record and form',()=>{
  const data=reads();
  data.leads.data=[{id:'first-lead',customer_name:'First'},{id:'second-lead',customer_name:'Second'}];
  const {html}=renderIntelligence(data);
  for(const leadId of ['first-lead','second-lead']){
    const controlId=`intelligence-follow-up-${leadId}-what-did-the-customer-gc-say-`;
    assert.ok(html.includes(`for="${controlId}"`));
    assert.ok(html.includes(`id="${controlId}"`));
    assert.ok(html.includes(`id="${controlId}-label"`));
  }
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
  assert.match(html,/id="intelligence-market-feedback-lead"/);
  assert.match(html,/id="intelligence-value-option-lead"/);
});

test('local view copy uses semantic colors while persisted field names remain intact',()=>{
  const source=readFileSync('components/opportunities/views/BidIntelligenceView.tsx','utf8');
  assert.doesNotMatch(source,/\bCarez\b|CAREZ|#AAAAAA|#EDEDED|#222222|#111111/);
  assert.match(source,/Field as FluentField/);
  assert.match(source,/name="carez_status"/);
  const {html}=renderIntelligence(reads());
  assert.match(html,/PourTrace/);
  assert.doesNotMatch(html,/\bCarez\b|CAREZ/);
});
