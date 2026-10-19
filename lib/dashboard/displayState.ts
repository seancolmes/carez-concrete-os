/** Presentation coverage only. These helpers never calculate or clear job holds. */
export function dashboardPlanningAction(nextAction:string|null|undefined,jobReady:boolean|null|undefined){
 const staleIntakePrompt='Review external agreement evidence and Job Setup before physical work.';
 return jobReady===true&&nextAction===staleIntakePrompt?'Schedule the next work.':nextAction||'Schedule the next work.';
}

export function metricIsZero(value:string){
 return /^\$?0(?:\.0+)?(?:\s*(?:CY|hrs?))?$/.test(value.trim());
}

export function dashboardDetailState(input:{fieldValues:string[];financialValues:{label:string;value:string}[];pipelineCount:number;pipelineUnavailable:boolean;pourCount:number;pourUnavailable:boolean}){
 const meaningfulFinancial=input.financialValues.filter(metric=>!['Contract backlog','Earned / unbilled'].includes(metric.label));
 const values=[...input.fieldValues,...meaningfulFinancial.map(metric=>metric.value)];
 return {
  hasActivity:values.some(value=>value!=='—'&&!metricIsZero(value))||input.pipelineCount>0||input.pourCount>0,
  incomplete:values.includes('—')||input.financialValues.some(metric=>metric.value==='—')||input.pipelineUnavailable||input.pourUnavailable,
 };
}
