'use client';
import {useActionState,useState} from 'react';
import {Button,Checkbox,Field,Select,Textarea} from '@fluentui/react-components';
import {verifyExternalAgreement} from '@/app/job-setup/external-agreement-actions';
type Document={id:string;title:string;content_sha256:string;byte_size:number};
export function ExternalAgreementForm({requestId,projectId,previousId,reference,amount,documents,canRevoke}:{requestId:string;projectId:string;previousId:string|null;reference:string;amount:string;documents:Document[];canRevoke:boolean}){
 const [state,action,pending]=useActionState(verifyExternalAgreement,{error:'',message:''});const [basis,setBasis]=useState('owner_attestation_copy_pending'),[documentId,setDocumentId]=useState(''),[note,setNote]=useState(''),[acknowledged,setAcknowledged]=useState(false);const document=documents.find(item=>item.id===documentId);
 return <form action={action} className="grid min-w-0 gap-3" aria-busy={pending}>
  <input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="project_id" value={projectId}/><input type="hidden" name="expected_event_id" value={previousId||''}/><input type="hidden" name="agreement_reference" value={reference}/><input type="hidden" name="agreement_amount" value={amount}/>
  <Field label="Owner verification basis"><Select name="evidence_basis" value={basis} disabled={pending} onChange={event=>setBasis(event.target.value)}><option value="owner_attestation_copy_pending">Externally signed · executed copy pending</option><option value="executed_copy_reviewed">I reviewed the retained executed copy</option></Select></Field>
  {basis==='executed_copy_reviewed'&&<><Field label="Retained executed agreement"><Select name="document_id" value={documentId} required disabled={pending} onChange={event=>setDocumentId(event.target.value)}><option value="">Choose the actual reviewed agreement</option>{documents.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</Select></Field><input type="hidden" name="document_sha256" value={document?.content_sha256||''}/><input type="hidden" name="document_byte_size" value={document?.byte_size??''}/></>}
  <Field label="Verification evidence / revocation reason"><Textarea name="note" value={note} onChange={(_,data)=>setNote(data.value)} rows={3} required minLength={10} maxLength={2000} disabled={pending}/></Field>
  <Checkbox input={{id:`external-agreement-confirm-${projectId}`}} name="acknowledged" checked={acknowledged} onChange={(_,data)=>setAcknowledged(data.checked===true)} disabled={pending} label="I am the company owner and verify that this external agreement is signed for the recorded amount. This is my verification, not a customer signature or internal awarded budget."/>
  <div className="flex flex-wrap gap-2"><Button type="submit" name="action" value="verify" appearance="primary" disabled={pending||!!state.message}>Record owner verification</Button>{canRevoke&&<Button type="submit" name="action" value="revoke" formNoValidate appearance="outline" disabled={pending||!!state.message}>Revoke verification</Button>}</div>
  {state.error&&<p role="alert" className="break-words text-sm text-destructive">{state.error}</p>}{state.message&&<p role="status" className="break-words text-sm text-muted-foreground">{state.message}</p>}
 </form>;
}
