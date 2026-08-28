'use client';
import {useEffect,useState} from 'react';

export function InviteLinkBox({path}:{path:string}){
 const [url,setUrl]=useState(path);const [copied,setCopied]=useState(false);
 useEffect(()=>{setUrl(`${window.location.origin}${path}`)},[path]);
 async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{setCopied(false);}}
 return <div className="surface-body"><label className="field"><span>Employee Invite Link</span><input value={url} readOnly onFocus={e=>e.currentTarget.select()}/></label><div className="action-row"><button className="button" type="button" onClick={copy}>{copied?'Copied':'Copy Invite Link'}</button></div><div className="meta">Send this link only to the employee it was created for. It expires automatically.</div></div>;
}
