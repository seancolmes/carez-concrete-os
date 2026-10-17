import assert from 'node:assert/strict';
import test from 'node:test';
import {renderIntelligence} from './fixtures/intelligence-render.ts';
import {
  intelligenceComparisonState, intelligenceReadNames, intelligenceReadState,
  type IntelligenceReads,
} from '../components/opportunities/views/intelligence-read-state.ts';

const emptyReads = (): IntelligenceReads => Object.fromEntries(
  intelligenceReadNames.map(name => [name, {data: [], error: null}]),
) as unknown as IntelligenceReads;
const failed = {data: null, error: {code: 'QA_READ_FAILURE', message: 'Local test failure'}};

test('populated reads preserve the existing pipeline inclusion and win-rate formulas', () => {
  const reads = emptyReads();
  reads.pipeline.data = [
    {pipeline_stage: 'estimating'},
    {pipeline_stage: 'proposal_out', needs_follow_up: true},
    {pipeline_stage: 'won'}, {pipeline_stage: 'lost'}, {pipeline_stage: 'passed'},
  ];
  reads.winRates.data = [{decided_bids: 4, wins: 1}, {decided_bids: 2, wins: 2}];
  const model = intelligenceReadState(reads);
  assert.equal(model.activePursuits, 2);
  assert.equal(model.proposalsOut, 1);
  assert.equal(model.followupsDue, 1);
  assert.equal(model.decided, 6);
  assert.equal(model.wins, 3);
  assert.equal(100 * model.wins! / model.decided!, 50);
});

test('successful empty reads permit genuine zero counts and profile creation', () => {
  const model = intelligenceReadState(emptyReads());
  assert.deepEqual([model.activePursuits, model.proposalsOut, model.followupsDue, model.decided, model.wins], [0, 0, 0, 0, 0]);
  assert.equal(model.available.profiles, true);
  assert.equal(model.choicesAvailable, true);
  assert.equal(intelligenceComparisonState(model, undefined), 'missing');
});

test('recorded zero rates and amounts remain present, rather than unavailable', () => {
  const reads = emptyReads();
  const profile = {lead_id: 'lead', customer_budget: 0, estimator_effort_hours: 0};
  const option = {base_sell_price: 0, option_sell_price: 0, company_cost_change: 0};
  reads.profiles.data = [profile];
  reads.options.data = [option];
  reads.winRates.data = [{decided_bids: 2, wins: 0, win_rate_percent: 0}];
  const model = intelligenceReadState(reads);
  assert.equal(model.records.profiles[0], profile);
  assert.equal(model.records.options[0], option);
  assert.equal(model.wins, 0);
  assert.equal(model.decided, 2);
  assert.equal(model.available.options, true);
});

for (const name of intelligenceReadNames) {
  test(`${name} failure is independent and preserves other known records`, () => {
    const reads = emptyReads();
    for (const key of intelligenceReadNames) reads[key].data = [{id: key}];
    reads[name] = failed;
    const model = intelligenceReadState(reads);
    assert.equal(model.available[name], false);
    assert.equal(reads[name].error, failed.error);
    for (const key of intelligenceReadNames.filter(key => key !== name)) {
      assert.equal(model.available[key], true);
      assert.equal(model.records[key], reads[key].data);
    }
  });
}

test('pipeline failure makes all three dependent counts unavailable but preserves win history', () => {
  const reads = emptyReads();
  reads.pipeline = failed;
  reads.winRates.data = [{decided_bids: 3, wins: 1}];
  const model = intelligenceReadState(reads);
  assert.deepEqual([model.activePursuits, model.followupsDue, model.proposalsOut], [null, null, null]);
  assert.equal(model.decided, 3);
  assert.equal(model.wins, 1);
});

test('win-history failure cannot generate zero-decided guidance or erase pipeline counts', () => {
  const reads = emptyReads();
  reads.pipeline.data = [{pipeline_stage: 'proposal_out', needs_follow_up: true}];
  reads.winRates = failed;
  const model = intelligenceReadState(reads);
  assert.equal(model.decided, null);
  assert.equal(model.wins, null);
  assert.equal(model.activePursuits, 1);
  assert.equal(model.followupsDue, 1);
});

test('a failed profile read forbids default-filled editing, independently of lead availability', () => {
  const reads = emptyReads();
  reads.profiles = failed;
  reads.leads.data = [{id: 'known-lead'}];
  const model = intelligenceReadState(reads);
  assert.equal(model.available.profiles, false);
  assert.equal(model.records.leads[0].id, 'known-lead');
  assert.equal(model.choicesAvailable, true);
});

test('each failed choice list blocks dependent forms, including optional estimate choices', () => {
  for (const name of ['leads', 'estimates'] as const) {
    const reads = emptyReads();
    reads[name] = failed;
    assert.equal(intelligenceReadState(reads).choicesAvailable, false);
  }
});

test('comparison conclusions require feedback, leveling and scope reads independently', () => {
  for (const name of ['feedback', 'leveling', 'scopeItems'] as const) {
    const reads = emptyReads();
    reads[name] = failed;
    const model = intelligenceReadState(reads);
    assert.equal(intelligenceComparisonState(model, {comparison_ready: true}), 'unavailable');
    assert.equal(intelligenceComparisonState(model, {comparison_ready: false}), 'unavailable');
    assert.equal(intelligenceComparisonState(model, undefined), 'unavailable');
    assert.equal(model.guardrailComparisonAvailable, false);
  }
});

test('successful comparison reads preserve explicit server decisions and distinguish missing records', () => {
  const model = intelligenceReadState(emptyReads());
  assert.equal(intelligenceComparisonState(model, {comparison_ready: true}), 'ready');
  assert.equal(intelligenceComparisonState(model, {comparison_ready: false}), 'needs-scope-check');
  assert.equal(intelligenceComparisonState(model, {}), 'unavailable');
  assert.equal(intelligenceComparisonState(model, undefined), 'missing');
});

test('unexpected absent collection data is unavailable, not a confirmed empty result', () => {
  const reads = emptyReads();
  reads.pipeline = {data: null, error: null};
  const model = intelligenceReadState(reads);
  assert.equal(model.available.pipeline, false);
  assert.equal(model.activePursuits, null);
});

test('retained data does not turn an errored read into a complete count', () => {
  const reads = emptyReads();
  reads.pipeline = {data: [{pipeline_stage: 'estimating'}], error: failed.error};
  const model = intelligenceReadState(reads);
  assert.equal(model.records.pipeline, reads.pipeline.data);
  assert.equal(model.activePursuits, null);
});

test('rendered profile editor permits successful-empty creation but not a failed read', () => {
  const reads = emptyReads();
  reads.leads.data = [{id: 'lead', customer_name: 'Known customer', project_name: 'Known job'}];
  assert.match(renderIntelligence(reads).html, /name="project_fit_score"/);
  reads.profiles = failed;
  const {html} = renderIntelligence(reads);
  assert.doesNotMatch(html, /name="project_fit_score"/);
  assert.match(html, /Pursuit profiles/);
  assert.match(html, /Known job/);
});

test('rendered failed win history does not claim learning or successful empty history', () => {
  const reads = emptyReads();
  reads.winRates = failed;
  const {html} = renderIntelligence(reads);
  assert.match(html, /Win-rate history/);
  assert.doesNotMatch(html, /Learning|No decided-bid history yet|does not have enough bid outcomes/);
});

test('rendered choice failures block dependent forms without erasing known options', () => {
  for (const name of ['leads', 'estimates'] as const) {
    const reads = emptyReads();
    reads[name] = failed;
    reads.options.data = [{id: 'option', name: 'Known alternate', status: 'suggested', base_sell_price: 0}];
    const {html} = renderIntelligence(reads);
    assert.doesNotMatch(html, /name="competitor_name"|name="customer_description"/);
    assert.match(html, name === 'leads' ? /Lead choices/ : /Estimate choices/);
    assert.match(html, /Known alternate/);
    assert.match(html, /\$0/);
  }
});

test('mixed failures preserve independent pricing and feedback without comparison conclusions', () => {
  const reads = emptyReads();
  for (const name of ['pipeline', 'profiles', 'scopeItems', 'winRates'] as const) reads[name] = failed;
  reads.leads.data = [{id: 'lead', customer_name: 'Known customer', project_name: 'Known job'}];
  reads.guardrails.data = [{estimate_id: 'estimate', name: 'Known pricing', selected_sell_price: 120000, protected_break_even_price: 90000, safe_for_price_comparison: true, price_guidance: 'Ready to compare'}];
  reads.feedback.data = [{id: 'feedback', competitor_name: 'Known feedback', competitor_price: 110000}];
  reads.leveling.data = [{bid_price_feedback_id: 'feedback', comparison_ready: true, equalization_amount: 0, leveled_competitor_price: 110000}];
  const {html} = renderIntelligence(reads);
  for (const known of ['Known job', 'Known pricing', 'Known feedback']) assert.ok(html.includes(known));
  assert.match(html, /\$120,000/);
  assert.match(html, /Comparison unavailable/);
  assert.doesNotMatch(html, />leveled<|>needs scope check<|Ready to compare|name="description"/);
});
