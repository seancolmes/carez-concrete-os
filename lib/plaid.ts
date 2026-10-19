import crypto from 'node:crypto';

const PLAID_BASE={sandbox:'https://sandbox.plaid.com',development:'https://development.plaid.com',production:'https://production.plaid.com'} as const;

export function plaidEnvironment(value:string|undefined){
  const env=value?.trim().toLowerCase();
  return env==='sandbox'||env==='development'||env==='production'?env:null;
}

export function plaidConfigured(){return Boolean(process.env.PLAID_CLIENT_ID&&process.env.PLAID_SECRET&&plaidEnvironment(process.env.PLAID_ENV));}
function cfg(){
  const clientId=process.env.PLAID_CLIENT_ID,secret=process.env.PLAID_SECRET;
  if(!clientId||!secret)throw new Error('Plaid environment variables are missing.');
  const env=plaidEnvironment(process.env.PLAID_ENV);
  if(!env)throw new Error('PLAID_ENV must be sandbox, development, or production.');
  return {clientId,secret,env,base:PLAID_BASE[env]};
}
export async function plaidPost<T=any>(path:string,body:Record<string,any>,options:{signal?:AbortSignal}={}):Promise<T>{
  const {clientId,secret,base}=cfg();
  const response=await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json','PLAID-CLIENT-ID':clientId,'PLAID-SECRET':secret},body:JSON.stringify(body),cache:'no-store',signal:options.signal});
  const data=await response.json();
  if(!response.ok||data?.error_code){const e=new Error(data?.display_message||data?.error_message||`Plaid request failed (${response.status})`) as Error&{code?:string};e.code=data?.error_code;e.name='PlaidError';throw e;}
  return data as T;
}
function tokenKey(){const material=process.env.PLAID_TOKEN_ENCRYPTION_KEY||process.env.PLAID_SECRET;if(!material)throw new Error('Plaid token encryption key is unavailable.');return crypto.createHash('sha256').update(material).digest();}
export function encryptAccessToken(value:string){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',tokenKey(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return {ciphertext:encrypted.toString('base64'),iv:iv.toString('base64'),authTag:cipher.getAuthTag().toString('base64')};}
export function decryptAccessToken(row:{access_token_ciphertext:string;token_iv:string;token_auth_tag:string}){const decipher=crypto.createDecipheriv('aes-256-gcm',tokenKey(),Buffer.from(row.token_iv,'base64'));decipher.setAuthTag(Buffer.from(row.token_auth_tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(row.access_token_ciphertext,'base64')),decipher.final()]).toString('utf8');}
