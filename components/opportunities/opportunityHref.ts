/** Keep links inside the consolidated opportunity workspace. */
export const opportunityHref=(leadId:string,tab='scope')=>`/opportunities?lead=${encodeURIComponent(leadId)}&tab=${tab}`;
export const estimateHref=(estimateId:string,tab='worksheet',hash='',params='')=>`/opportunities?estimate=${encodeURIComponent(estimateId)}&tab=${tab}${params?`&${params}`:''}${hash}`;
export const auditHref=(estimateId?:string)=>`/opportunities?view=audit${estimateId?`&estimate=${encodeURIComponent(estimateId)}`:''}`;
