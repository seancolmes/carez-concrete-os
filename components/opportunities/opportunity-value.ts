type Amount=number|string|null|undefined;
type Estimate={estimate_number:string|null;version:number|null;proposed_sell_price:Amount};
type Summary={selected_sell_price:Amount;recommended_sell_price:Amount};

export type OpportunityValue={
  value:number|null;
  valueBasis:'selected-proposed'|'calculated'|'stored-proposed'|'lead'|'missing';
  valueRevision:string|null;
  financialSummaryMissing:boolean;
};

/** Mirrors the existing nullish fallback and the server's positive-proposed selection rule. */
export function resolveOpportunityValue({estimate,summary,leadValue}:{estimate?:Estimate;summary?:Summary;leadValue?:Amount}):OpportunityValue{
  const valueRevision=estimate?`${estimate.estimate_number}-R${estimate.version??0}`:null;
  const financialSummaryMissing=Boolean(estimate&&!summary);
  let value:Amount=undefined;
  let valueBasis:OpportunityValue['valueBasis']='missing';
  if(estimate){
    if(summary?.selected_sell_price!=null){
      value=summary.selected_sell_price;
      valueBasis=Number(estimate.proposed_sell_price)>0?'selected-proposed':'calculated';
    }else if(summary?.recommended_sell_price!=null){
      value=summary.recommended_sell_price;
      valueBasis='calculated';
    }else if(estimate.proposed_sell_price!=null){
      value=estimate.proposed_sell_price;
      valueBasis='stored-proposed';
    }
  }
  if(value==null&&leadValue!=null){value=leadValue;valueBasis='lead';}
  return {value:value==null?null:Number(value),valueBasis,valueRevision,financialSummaryMissing};
}

const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);

export function opportunityValuePresentation(value:OpportunityValue){
  const labels={
    'selected-proposed':'Selected proposed sell',
    calculated:'Calculated sell',
    'stored-proposed':'Stored proposed sell',
    lead:'Lead estimated value',
    missing:'Value not entered',
  };
  const estimateBasis=value.valueBasis!=='lead'&&value.valueBasis!=='missing';
  return {
    amount:value.value==null?'Not entered':money(value.value),
    basis:labels[value.valueBasis]+(estimateBasis&&value.valueRevision?` · ${value.valueRevision}`:''),
    guidance:value.valueBasis==='calculated'&&value.value===0?'Calculated from current estimate inputs':null,
    summaryWarning:value.financialSummaryMissing?'Financial summary missing'+(!estimateBasis&&value.valueRevision?` · ${value.valueRevision}`:''):null,
  };
}

export function openPipelineValue(values:readonly (number|null)[]){
  const known=values.filter((value):value is number=>value!==null);
  const knownSubtotal=known.reduce((sum,value)=>sum+value,0);
  const missingCount=values.length-known.length;
  const coverage=values.length===0?'none':known.length===0?'missing':missingCount?'partial':'complete';
  const coverageGuidance='Amount coverage does not establish approved pricing or pricing readiness.';
  return {
    coverage,knownSubtotal,knownCount:known.length,missingCount,
    display:coverage==='none'?'No open bids':coverage==='missing'?'Value not entered':coverage==='partial'?`Known subtotal ${money(knownSubtotal)}`:money(knownSubtotal),
    detail:coverage==='none'?'No open lead or bid values to total.':coverage==='missing'?`${missingCount} open ${missingCount===1?'bid has':'bids have'} no value entered.`:coverage==='partial'?`${missingCount} open ${missingCount===1?'bid without a value':'bids without values'}. ${coverageGuidance}`:`Values available for ${known.length} of ${values.length} open bids. ${coverageGuidance}`,
  };
}
