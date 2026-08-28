import crypto from 'node:crypto';

const GRAPH='https://graph.microsoft.com/v1.0';

export function outlookConfigured(){return Boolean(process.env.MICROSOFT_CLIENT_ID&&process.env.MICROSOFT_CLIENT_SECRET);}

function cfg(){
  const clientId=process.env.MICROSOFT_CLIENT_ID,clientSecret=process.env.MICROSOFT_CLIENT_SECRET;
  if(!clientId||!clientSecret)throw new Error('Microsoft Outlook environment variables are missing.');
  return {clientId,clientSecret,tenant:process.env.MICROSOFT_TENANT_ID||'common'};
}

function key(){
  const material=process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY||process.env.PLAID_TOKEN_ENCRYPTION_KEY||process.env.PLAID_SECRET;
  if(!material)throw new Error('Outlook token encryption key is unavailable.');
  return crypto.createHash('sha256').update(material).digest();
}

export function encryptOutlookToken(value:string){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return {ciphertext:encrypted.toString('base64'),iv:iv.toString('base64'),authTag:cipher.getAuthTag().toString('base64')};
}

export function decryptOutlookToken(ciphertext:string,iv:string,authTag:string){
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64'));
  decipher.setAuthTag(Buffer.from(authTag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext,'base64')),decipher.final()]).toString('utf8');
}

export function outlookRedirectUri(origin:string){return process.env.MICROSOFT_REDIRECT_URI||`${origin}/api/outlook/callback`;}

export function outlookAuthorizeUrl(origin:string,state:string){
  const {clientId,tenant}=cfg();
  const p=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:outlookRedirectUri(origin),response_mode:'query',scope:'offline_access User.Read Mail.Read',state,prompt:'select_account'});
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${p}`;
}

async function tokenRequest(params:Record<string,string>){
  const {clientId,clientSecret,tenant}=cfg();
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,...params});
  const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store'});
  const data:any=await response.json();
  if(!response.ok||data.error)throw new Error(data.error_description||data.error||`Microsoft token request failed (${response.status})`);
  return data;
}

export async function exchangeOutlookCode(code:string,origin:string){return tokenRequest({grant_type:'authorization_code',code,redirect_uri:outlookRedirectUri(origin),scope:'offline_access User.Read Mail.Read'});}
export async function refreshOutlookToken(refreshToken:string){return tokenRequest({grant_type:'refresh_token',refresh_token:refreshToken,scope:'offline_access User.Read Mail.Read'});}

export async function graphRequest<T=any>(accessToken:string,path:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(path.startsWith('http')?path:`${GRAPH}${path}`,{...init,headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',...(init.headers||{})},cache:'no-store'});
  const text=await response.text();const data:any=text?JSON.parse(text):{};
  if(!response.ok)throw new Error(data?.error?.message||`Microsoft Graph request failed (${response.status})`);
  return data as T;
}

export async function ensureOutlookAccessToken(supabase:any,connection:any){
  const expires=new Date(connection.token_expires_at||0).getTime();
  if(expires>Date.now()+5*60*1000)return decryptOutlookToken(connection.access_token_ciphertext,connection.access_token_iv,connection.access_token_auth_tag);
  const refresh=decryptOutlookToken(connection.refresh_token_ciphertext,connection.refresh_token_iv,connection.refresh_token_auth_tag);
  const tokens:any=await refreshOutlookToken(refresh);
  const access=encryptOutlookToken(tokens.access_token),nextRefresh=encryptOutlookToken(tokens.refresh_token||refresh),tokenExpires=new Date(Date.now()+Number(tokens.expires_in||3600)*1000).toISOString();
  await supabase.from('outlook_connections').update({access_token_ciphertext:access.ciphertext,access_token_iv:access.iv,access_token_auth_tag:access.authTag,refresh_token_ciphertext:nextRefresh.ciphertext,refresh_token_iv:nextRefresh.iv,refresh_token_auth_tag:nextRefresh.authTag,token_expires_at:tokenExpires,last_error:null,updated_at:new Date().toISOString()}).eq('id',connection.id);
  return tokens.access_token as string;
}

export async function createOutlookSubscription(accessToken:string,origin:string,clientState:string){
  const expirationDateTime=new Date(Date.now()+2.75*24*60*60*1000).toISOString();
  return graphRequest<any>(accessToken,'/subscriptions',{method:'POST',body:JSON.stringify({changeType:'created',notificationUrl:`${origin}/api/outlook/webhook`,resource:"me/mailFolders('Inbox')/messages",expirationDateTime,clientState})});
}

export async function renewOutlookSubscription(accessToken:string,subscriptionId:string){
  const expirationDateTime=new Date(Date.now()+2.75*24*60*60*1000).toISOString();
  return graphRequest<any>(accessToken,`/subscriptions/${encodeURIComponent(subscriptionId)}`,{method:'PATCH',body:JSON.stringify({expirationDateTime})});
}

export type OutlookLeadCandidate={
  classification:'lead'|'possible_lead'|'other';confidence:number;autoCreate:boolean;
  customerName:string|null;contactName:string|null;email:string|null;phone:string|null;
  projectName:string|null;address:string|null;city:string|null;state:string;postalCode:string|null;scope:string|null;bidDue:string|null;
};

const constructionWords=['concrete','driveway','foundation','footing','footings','slab','sidewalk','patio','stem wall','retaining wall','curb','flatwork','pour','rebar','garage slab'];
const intentWords=['estimate','quote','bid','pricing','price','project','job','work','proposal','plans','takeoff'];
const systemDomains=['notification.intuit.com','plaid.com','microsoft.com','vercel.com','docusign.net','adobe.com'];

function emailDomain(email:string){return email.toLowerCase().split('@')[1]||'';}
function cleanSubject(subject:string){return subject.replace(/^\s*((re|fw|fwd)\s*:\s*)+/i,'').trim();}
function extractPhone(text:string){const m=text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);return m?m[0].trim():null;}
function extractAddress(text:string){const m=text.match(/\b\d{1,6}\s+[A-Za-z0-9.' -]{2,45}\s(?:St(?:reet)?|Ave(?:nue)?|Rd|Road|Dr(?:ive)?|Ln|Lane|Ct|Court|Way|Blvd|Boulevard|Pl|Place)\b[^\n,]*/i);return m?m[0].trim():null;}
function safePreview(v:string){return v.replace(/\s+/g,' ').trim().slice(0,900)||null;}

export function classifyOutlookMessage(message:any):OutlookLeadCandidate{
  const subject=String(message?.subject||''),preview=String(message?.bodyPreview||''),senderName=String(message?.from?.emailAddress?.name||message?.senderName||'').trim(),senderEmail=String(message?.from?.emailAddress?.address||message?.senderEmail||'').trim().toLowerCase();
  const hay=`${subject} ${preview}`.toLowerCase(),domain=emailDomain(senderEmail);
  if(systemDomains.some(d=>domain===d||domain.endsWith(`.${d}`))||/no-?reply|do-?not-?reply/i.test(senderEmail))return {classification:'other',confidence:.99,autoCreate:false,customerName:senderName||null,contactName:senderName||null,email:senderEmail||null,phone:null,projectName:null,address:null,city:null,state:'WA',postalCode:null,scope:null,bidDue:null};
  const constructionHits=constructionWords.filter(w=>hay.includes(w)).length,intentHits=intentWords.filter(w=>hay.includes(w)).length;
  let confidence=.12+Math.min(.42,constructionHits*.18)+Math.min(.34,intentHits*.12);
  if(/estimate|quote|bid|pricing/i.test(subject))confidence+=.12;
  if(/concrete|foundation|driveway|slab/i.test(subject))confidence+=.12;
  confidence=Math.min(.98,confidence);
  const classification=confidence>=.78?'lead':confidence>=.48?'possible_lead':'other';
  const autoCreate=classification==='lead'&&confidence>=.9&&constructionHits>0&&intentHits>0;
  const cleaned=cleanSubject(subject),address=extractAddress(preview),phone=extractPhone(preview);
  const generic=/^(concrete|concrete job|estimate|estimate request|quote|quote request|bid|project)$/i.test(cleaned);
  return {classification,confidence,autoCreate,customerName:senderName||senderEmail||null,contactName:senderName||null,email:senderEmail||null,phone,projectName:cleaned&&!generic?cleaned:null,address,city:null,state:'WA',postalCode:null,scope:safePreview(preview),bidDue:null};
}

function generatedProjectName(candidate:OutlookLeadCandidate){const customer=candidate.customerName||candidate.contactName||candidate.email||'New Customer';return candidate.projectName||`${customer}${candidate.address?` - ${candidate.address}`:candidate.city?` - ${candidate.city}`:''}`;}

export async function ingestAuthenticatedOutlookMessage(supabase:any,companyId:string,message:any){
  const messageId=String(message.id||'');if(!messageId)return 'ignored';
  const {data:existing}=await supabase.from('outlook_messages').select('id,lead_id').eq('company_id',companyId).eq('outlook_message_id',messageId).maybeSingle();if(existing)return existing.lead_id?'created':'existing';
  const c=classifyOutlookMessage(message);
  const {data:saved,error}=await supabase.from('outlook_messages').insert({company_id:companyId,outlook_message_id:messageId,conversation_id:message.conversationId||null,internet_message_id:message.internetMessageId||null,subject:message.subject||null,sender_name:message?.from?.emailAddress?.name||null,sender_email:message?.from?.emailAddress?.address||null,received_at:message.receivedDateTime||null,body_preview:message.bodyPreview||null,web_link:message.webLink||null,classification:c.classification,confidence:c.confidence}).select('id').single();
  if(error||!saved)throw new Error(error?.message||'Could not save Outlook message');
  if(c.classification==='other')return 'ignored';
  if(c.autoCreate){
    const {data:opp,error:oppError}=await supabase.rpc('next_opportunity_number');if(oppError||!opp)throw new Error(oppError?.message||'Could not create lead number');
    const projectName=generatedProjectName(c);
    const {data:lead,error:leadError}=await supabase.from('leads').insert({company_id:companyId,opportunity_number:opp,customer_name:c.customerName||'New Customer',contact_name:c.contactName,email:c.email,phone:c.phone,project_name:projectName,address:c.address,city:c.city,state:c.state,postal_code:c.postalCode,scope:c.scope,bid_due:c.bidDue,status:'new',source:'outlook',source_message_id:messageId,source_conversation_id:message.conversationId||null,notes:'Automatically created from Outlook'}).select('id').single();
    if(leadError||!lead)throw new Error(leadError?.message||'Could not create Outlook lead');
    await Promise.all([supabase.from('outlook_messages').update({lead_id:lead.id}).eq('id',saved.id),supabase.from('lead_activities').insert({company_id:companyId,lead_id:lead.id,activity_type:'email',note:`Lead automatically created from Outlook email: ${message.subject||'No subject'}`})]);
    return 'created';
  }
  await supabase.from('lead_inbox_candidates').insert({company_id:companyId,outlook_message_id:saved.id,confidence:c.confidence,customer_name:c.customerName,contact_name:c.contactName,email:c.email,phone:c.phone,project_name:generatedProjectName(c),address:c.address,city:c.city,state:c.state,postal_code:c.postalCode,scope:c.scope,bid_due:c.bidDue});
  return 'candidate';
}

export async function syncOutlookMailbox(supabase:any,companyId:string,connection:any){
  const access=await ensureOutlookAccessToken(supabase,connection);
  const data:any=await graphRequest(access,"/me/mailFolders('Inbox')/messages?$top=40&$orderby=receivedDateTime%20desc&$select=id,conversationId,internetMessageId,subject,from,receivedDateTime,bodyPreview,webLink");
  let created=0,candidates=0,ignored=0;
  for(const m of data.value||[]){const status=await ingestAuthenticatedOutlookMessage(supabase,companyId,m);if(status==='created')created++;else if(status==='candidate')candidates++;else ignored++;}
  await supabase.from('outlook_connections').update({last_sync_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',connection.id).eq('company_id',companyId);
  return {created,candidates,ignored};
}
