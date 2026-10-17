import assert from 'node:assert/strict';
import test from 'node:test';
import {openPipelineValue,opportunityValuePresentation,resolveOpportunityValue} from '../components/opportunities/opportunity-value.ts';

const estimate={estimate_number:'E-001',version:3,proposed_sell_price:0};

test('a positive proposed price supplies selected proposed sell and its supplying revision',()=>{
  const value=resolveOpportunityValue({estimate:{...estimate,proposed_sell_price:'125000'},summary:{selected_sell_price:'125000',recommended_sell_price:'100000'},leadValue:150000});
  assert.equal(value.value,125000);
  assert.equal(value.valueBasis,'selected-proposed');
  assert.equal(value.valueRevision,'E-001-R3');
  assert.equal(opportunityValuePresentation(value).basis,'Selected proposed sell · E-001-R3');
});

test('positive calculated sell is never labeled as a human-selected proposed price',()=>{
  for(const proposed_sell_price of [0,-1,null]){
    const value=resolveOpportunityValue({estimate:{...estimate,proposed_sell_price},summary:{selected_sell_price:'100000',recommended_sell_price:'100000'}});
    assert.equal(value.value,100000);
    assert.equal(value.valueBasis,'calculated');
    assert.equal(opportunityValuePresentation(value).basis,'Calculated sell · E-001-R3');
  }
});

test('calculated zero stops the fallback and carries guidance rather than becoming missing',()=>{
  const value=resolveOpportunityValue({estimate,summary:{selected_sell_price:0,recommended_sell_price:0},leadValue:150000});
  assert.equal(value.value,0);
  assert.equal(value.financialSummaryMissing,false);
  assert.equal(opportunityValuePresentation(value).amount,'$0');
  assert.equal(opportunityValuePresentation(value).guidance,'Calculated from current estimate inputs');
});

test('recommended, stored proposed, then lead values retain the existing fallback order',()=>{
  const recommended=resolveOpportunityValue({estimate:{...estimate,proposed_sell_price:120},summary:{selected_sell_price:null,recommended_sell_price:100},leadValue:150});
  assert.equal(recommended.value,100);
  assert.equal(recommended.valueBasis,'calculated');
  const stored=resolveOpportunityValue({estimate:{...estimate,proposed_sell_price:120},summary:{selected_sell_price:null,recommended_sell_price:null},leadValue:150});
  assert.equal(stored.value,120);
  assert.equal(stored.valueBasis,'stored-proposed');
  assert.equal(stored.financialSummaryMissing,false);
  const lead=resolveOpportunityValue({estimate:{...estimate,proposed_sell_price:null},leadValue:150});
  assert.equal(lead.value,150);
  assert.equal(lead.valueBasis,'lead');
  assert.equal(opportunityValuePresentation(lead).basis,'Lead estimated value');
});

test('missing expected summary preserves stored zero and explicitly exposes the missing summary',()=>{
  const value=resolveOpportunityValue({estimate,leadValue:150000});
  assert.equal(value.value,0);
  assert.equal(value.valueBasis,'stored-proposed');
  assert.equal(value.financialSummaryMissing,true);
  assert.equal(opportunityValuePresentation(value).summaryWarning,'Financial summary missing');
  assert.equal(opportunityValuePresentation(value).guidance,null);
});

test('an unestimated lead has no expected summary and recorded lead zero remains known',()=>{
  const value=resolveOpportunityValue({leadValue:0});
  assert.equal(value.value,0);
  assert.equal(value.valueBasis,'lead');
  assert.equal(value.valueRevision,null);
  assert.equal(value.financialSummaryMissing,false);
  assert.equal(opportunityValuePresentation(value).summaryWarning,null);
  const missing=resolveOpportunityValue({});
  assert.equal(missing.value,null);
  assert.equal(missing.valueBasis,'missing');
  assert.equal(missing.financialSummaryMissing,false);
  assert.equal(opportunityValuePresentation(missing).amount,'Not entered');
});

test('missing estimate values and missing summary are separate from genuine zero',()=>{
  const missing=resolveOpportunityValue({estimate:{...estimate,proposed_sell_price:null}});
  assert.equal(missing.value,null);
  assert.equal(missing.valueRevision,'E-001-R3');
  assert.equal(opportunityValuePresentation(missing).summaryWarning,'Financial summary missing · E-001-R3');
});

test('complete amount coverage includes zero without asserting approved pricing or readiness',()=>{
  const complete=openPipelineValue([0,100000]);
  assert.equal(complete.coverage,'complete');
  assert.equal(complete.knownSubtotal,100000);
  assert.equal(complete.knownCount,2);
  assert.equal(complete.missingCount,0);
  assert.equal(complete.display,'$100,000');
  assert.match(complete.detail,/Amount coverage does not establish approved pricing or pricing readiness/);
  assert.equal(openPipelineValue([0]).display,'$0');
});

test('partial coverage preserves known subtotal and counts missing bids',()=>{
  const partial=openPipelineValue([100000,null,0,null]);
  assert.equal(partial.coverage,'partial');
  assert.equal(partial.knownSubtotal,100000);
  assert.equal(partial.knownCount,2);
  assert.equal(partial.missingCount,2);
  assert.equal(partial.display,'Known subtotal $100,000');
  assert.match(partial.detail,/2 open bids without values/);
});

test('all missing and no open bids display distinct states instead of a zero total',()=>{
  const missing=openPipelineValue([null,null]);
  assert.equal(missing.coverage,'missing');
  assert.equal(missing.display,'Value not entered');
  assert.equal(missing.missingCount,2);
  const none=openPipelineValue([]);
  assert.equal(none.coverage,'none');
  assert.equal(none.display,'No open bids');
});
