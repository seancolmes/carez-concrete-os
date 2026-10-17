const headers={
 'Cache-Control':'no-store',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function validLink(token:unknown,type:unknown):token is string{
 return typeof token==='string'&&token.length>0&&token.length<=2048&&type==='recovery';
}
const redirect=(path:string,origin:string)=>new Response(null,{status:303,headers:{...headers,Location:new URL(path,origin).href}});

/** Inert email-link landing. GET and HEAD must never call the Auth provider. */
export async function recoveryHttp(request:Request,origin:string,confirm:(tokenHash:string)=>Promise<void>){
 if(request.method==='HEAD')return new Response(null,{headers});
 if(request.method==='GET'){
  const url=new URL(request.url),token=url.searchParams.get('token_hash'),type=url.searchParams.get('type');
  if(!validLink(token,type))return new Response('This recovery link is invalid. Request a new password-reset email.',{status:400,headers});
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reset your PourTrace password</title><style>body{margin:0;background:#F4F6F8;color:#1A2B55;font:16px/1.5 system-ui,sans-serif;min-height:100svh;display:grid;place-items:center}main{box-sizing:border-box;background:white;border:1px solid #D8DEE8;padding:32px;width:min(440px,calc(100% - 32px))}h1{font-size:24px;line-height:1.2}p{color:#526174}button{font:inherit;font-weight:600;min-height:44px;background:#1A2B55;color:white;border:0;padding:12px 18px;width:100%;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #A96B12;outline-offset:3px}a{color:#1A2B55}footer{margin-top:24px}</style></head><body><main><strong>PourTrace</strong><h1>Reset your password</h1><p>Continue to choose a new password for your account.</p><form action="/auth/recovery" method="post"><input type="hidden" name="token_hash" value="${escape(token)}"><input type="hidden" name="type" value="recovery"><button type="submit">Continue to password reset</button></form><footer><a href="/login">Return to sign in</a></footer></main></body></html>`,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 }
 if(request.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD, POST'}});
 // A scanner's GET/HEAD never consumes the one-use token. A confirmation must
 // originate from the canonical application and deliberately submit its form.
 if(request.headers.get('origin')!==origin)return new Response('Recovery confirmation must come from this application.',{status:403,headers});
 try{
  const data=await request.formData(),token=data.get('token_hash');
  if(!validLink(token,data.get('type')))throw new Error('Invalid recovery link');
  await confirm(token);
  return redirect('/auth/reset-password',origin);
 }catch{
  // No cookie clearing: a failed duplicate must not erase a successful sibling.
  return redirect('/auth/forgot-password?recovery=failed',origin);
 }
}
