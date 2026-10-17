/** Configuration checks do not authenticate a key; Supabase still validates it. */
export function sourceWriterConfiguration(url:string|undefined,dedicatedKey:string|undefined,legacyKey?:string){
 const key=dedicatedKey??legacyKey;
 if(!url||!key)throw new Error('Verified source registration is unavailable. Server storage configuration is required.');
 let origin:URL;try{origin=new URL(url);}catch{throw new Error('Source storage origin is invalid.');}
 if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||(origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname))))throw new Error('Source storage requires its configured HTTPS origin or an isolated loopback origin.');
 if(!key.startsWith('sb_secret_')){
  let claims:{role?:string;ref?:string};try{claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));}catch{throw new Error('Source registration requires a server service credential.');}
  if(claims.role!=='service_role')throw new Error('Source registration requires a server service credential.');
  const project=/^([a-z0-9]+)\.supabase\.co$/.exec(origin.hostname)?.[1];
  if(project&&claims.ref&&claims.ref!==project)throw new Error('Source service credential belongs to a different Supabase project.');
 }
 return{url:origin.origin,key};
}
