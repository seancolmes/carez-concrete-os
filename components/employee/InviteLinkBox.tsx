'use client';
import {useEffect,useState} from 'react';
import {Button,Input,Label} from '@fluentui/react-components';

export function InviteLinkBox({path}:{path:string}){
 const [url,setUrl]=useState(path);
 const [copied,setCopied]=useState(false);
 useEffect(()=>{setUrl(`${window.location.origin}${path}`)},[path]);
 async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{setCopied(false);}}
 return <div className="grid gap-4">
  <div className="grid gap-1.5"><Label htmlFor="employee-invite-link">Employee Invite Link</Label><Input appearance="underline" id="employee-invite-link" value={url} readOnly onFocus={e=>e.currentTarget.select()}/></div>
  <div><Button type="button" appearance="primary" onClick={copy}>{copied?'Copied':'Copy Invite Link'}</Button></div>
  <p className="text-xs leading-5 text-muted-foreground">Send this link only to the employee it was created for. It expires automatically.</p>
 </div>;
}
