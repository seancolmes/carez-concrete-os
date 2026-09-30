'use client';

import {useState} from 'react';
import {Button} from '@fluentui/react-components';

export function CopyVendorLink({path}:{path:string}){
  const [copied,setCopied]=useState(false);
  return <Button type="button" appearance="outline" size="small" onClick={async()=>{
    try{
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),3000);
    }catch{setCopied(false);}
  }}>{copied?'Copied':'Copy supplier link'}</Button>;
}
