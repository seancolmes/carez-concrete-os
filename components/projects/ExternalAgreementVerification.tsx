import {randomUUID} from 'node:crypto';
import {createClient} from '@/lib/supabase/server';
import {ExternalAgreementForm} from './ExternalAgreementForm';
export async function ExternalAgreementVerification({projectId,companyId,role}:{projectId:string;companyId:string;role:string}){
 const client=await createClient();const intake=await client.from('project_external_intakes').select('agreement_reference,supplied_agreement_amount').eq('company_id',companyId).eq('project_id',projectId).maybeSingle();
 if(intake.error)return <p role="status" className="text-sm text-muted-foreground">External agreement evidence unavailable. Existing holds remain authoritative.</p>;
 if(!intake.data)return null;
 const [event,documents]=await Promise.all([client.from('external_agreement_verifications').select('id,action,evidence_basis,note,created_at').eq('company_id',companyId).eq('project_id',projectId).order('sequence_no',{ascending:false}).limit(1).maybeSingle(),client.from('company_documents').select('id,title,content_sha256,byte_size').eq('company_id',companyId).eq('project_id',projectId).eq('document_type','agreement').not('content_sha256','is',null)]);
 return <section className="space-y-3 border border-border bg-card p-3" aria-labelledby="external-agreement-verification"><h2 id="external-agreement-verification" className="text-base font-semibold">External agreement · owner verification</h2><p className="text-sm text-muted-foreground">Recorded agreement {intake.data.agreement_reference} · {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(intake.data.supplied_agreement_amount))}. External proposal differences and provisional changes remain separate. This does not create an internal Proposal, Award or accepted commercial baseline.</p>
  {event.error?<p role="status" className="text-sm text-destructive">Verification history unavailable. Verification controls are unavailable until the current record can be loaded.</p>:<>
   <p className="text-sm">{event.data?.action==='verify'?(event.data.evidence_basis==='owner_attestation_copy_pending'?'Owner verified · executed copy still pending.':'Owner verified · retained executed copy reviewed.'):event.data?.action==='revoke'?'Owner verification revoked. Agreement hold applies.':'No owner verification recorded. Agreement hold applies.'}</p>
   {event.data&&<p className="break-words text-sm text-muted-foreground">Owner verification record · {event.data.created_at} · {event.data.note}</p>}
   {documents.error&&<p role="status" className="text-sm text-muted-foreground">Retained agreement list unavailable. A reviewed-copy verification requires that list to load.</p>}
   {role==='owner'?<ExternalAgreementForm key={event.data?.id||'unverified'} requestId={randomUUID()} projectId={projectId} previousId={event.data?.id||null} reference={intake.data.agreement_reference} amount={String(intake.data.supplied_agreement_amount)} documents={documents.error?[]:documents.data||[]} canRevoke={event.data?.action==='verify'}/>:<p className="text-sm text-muted-foreground">Only your company owner can verify or revoke an external agreement.</p>}
  </>}
 </section>;
}
