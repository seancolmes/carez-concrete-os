'use client';

import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {deleteEstimate} from '@/app/estimates/actions';
import {Button} from '@/components/ui/button';

export function DeleteEstimateButton({estimateId}:{estimateId:string}){
  const router=useRouter();
  const [confirming,setConfirming]=useState(false);
  const [error,setError]=useState('');
  const [pending,startTransition]=useTransition();
  return <div className="space-y-2">
    {confirming?<>
      <p className="text-sm text-muted-foreground">Permanently delete this estimate? This cannot be undone.</p>
      <div className="flex gap-2">
        <Button variant="destructive" disabled={pending} onClick={()=>startTransition(async()=>{
          setError('');
          try{await deleteEstimate(estimateId);router.push('/opportunities');router.refresh();}
          catch(cause){setError(cause instanceof Error?cause.message:'Deletion failed.');}
        })}>{pending?'Deleting…':'Confirm deletion'}</Button>
        <Button variant="outline" disabled={pending} onClick={()=>{setConfirming(false);setError('');}}>Cancel</Button>
      </div>
    </>:<Button variant="destructive" onClick={()=>setConfirming(true)}>Delete Estimate</Button>}
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
  </div>;
}
