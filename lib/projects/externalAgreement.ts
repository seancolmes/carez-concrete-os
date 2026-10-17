const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function identity(fd:FormData,key:string,optional=false){const raw=fd.get(key);if(optional&&(raw===null||raw===''))return null;if(typeof raw!=='string'||!uuid.test(raw))throw new Error('Reopen the current agreement before continuing.');return raw;}
export function externalAgreementRequest(fd:FormData){
 const requestId=identity(fd,'request_id')!,projectId=identity(fd,'project_id')!,previousId=identity(fd,'expected_event_id',true);
 const action=fd.get('action'),basis=fd.get('evidence_basis'),amount=fd.get('agreement_amount'),reference=fd.get('agreement_reference'),note=fd.get('note');
 if(action!=='verify'&&action!=='revoke')throw new Error('Choose a verification action.');
 if(typeof amount!=='string'||!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount)||!Number.isFinite(Number(amount)))throw new Error('Reopen the recorded agreement amount.');
 if(typeof reference!=='string'||!reference.trim()||reference.length>500||typeof note!=='string'||note.trim().length<10||note.trim().length>2000)throw new Error('Record a specific verification or revocation reason.');
 const documentId=action==='verify'&&basis==='executed_copy_reviewed'?identity(fd,'document_id'):null;
 const hash=documentId?fd.get('document_sha256'):null,bytes=documentId?fd.get('document_byte_size'):null;
 if(documentId&&(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)||typeof bytes!=='string'||!/^\d+$/.test(bytes)||Number(bytes)<=0||!Number.isSafeInteger(Number(bytes))))throw new Error('Reopen the retained agreement evidence.');
 if(action==='verify'&&(basis!=='owner_attestation_copy_pending'&&basis!=='executed_copy_reviewed'||fd.get('acknowledged')!=='on'))throw new Error('Explicit owner verification is required.');
 return {requestId,payload:{project_id:projectId,expected_event_id:previousId,action,evidence_basis:action==='verify'?basis:null,agreement_amount:amount,agreement_reference:reference,note:note.trim(),document_id:documentId,document_sha256:hash,document_byte_size:bytes,acknowledged:action==='verify'}};
}
