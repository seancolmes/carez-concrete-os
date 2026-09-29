'use client';

import {useFormStatus} from 'react-dom';
import {LoaderCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';

export function PendingActionButton({label,pendingLabel,className}:{label:string;pendingLabel:string;className:string}){
  const {pending}=useFormStatus();
  return <Button type="submit" disabled={pending} aria-busy={pending} className={className}>
    {pending?<LoaderCircle aria-hidden="true" className="size-4 animate-spin"/>:null}
    {pending?pendingLabel:label}
  </Button>;
}
