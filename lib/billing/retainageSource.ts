export type ExternalBillingSource={project_id:string;retainage_percent:number|string|null;agreement_reference:string;billing_submission_day:number|null;billing_submission_channel:string|null};
export function milestoneInvoiceType(kind:string){
 if(kind==='retainage')throw new Error('Release retained amounts from the source invoice in Billing → Retainage. A retainage milestone cannot create new progress revenue.');
 if(!['deposit','progress','final','other'].includes(kind))throw new Error('Milestone invoice type unavailable.');
 return kind==='deposit'?'deposit':kind==='final'?'final':'progress';
}
export function invoiceRetainage(form:FormData,source:ExternalBillingSource|null){
 const raw=String(form.get('retainage_percent')??'').trim();
 if(!/^\d+(?:\.\d{1,3})?$/.test(raw)||!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>100)throw new Error('Enter a finite retainage percentage between0 and100. A missing rate is not zero.');
 const percent=Number(raw),recorded=source?.retainage_percent==null?null:Number(source.retainage_percent);
 return{percent,source:{basis:recorded!==null&&recorded===percent?'external_agreement_source':'explicit_draft_entry',rate_percent:percent,agreement_reference:source?.agreement_reference||null,recorded_rate_percent:recorded}};
}
