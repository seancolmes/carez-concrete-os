'use client';

import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {deleteTakeoffSet} from '@/app/takeoff/actions';
import {Button} from '@fluentui/react-components';

export function DeleteTakeoffButton({setId}:{setId:string}){
  const router=useRouter();
  const [confirming,setConfirming]=useState(false);
  const [error,setError]=useState('');
  const [pending,startTransition]=useTransition();
  return <div className="space-y-2">
    {confirming?<>
      <p className="text-sm text-muted-foreground">Permanently delete this takeoff set? This cannot be undone.</p>
      <div className="flex gap-2">
        <Button appearance="primary" style={{backgroundColor:'var(--pt-danger)',borderColor:'var(--pt-danger)',color:'white'}} disabled={pending} onClick={()=>startTransition(async()=>{
          setError('');
          try{await deleteTakeoffSet(setId);router.push('/opportunities');router.refresh();}
          catch(cause){setError(cause instanceof Error?cause.message:'Deletion failed.');}
        })}>{pending?'Deleting…':'Confirm deletion'}</Button>
        <Button appearance="outline" disabled={pending} onClick={()=>{setConfirming(false);setError('');}}>Cancel</Button>
      </div>
    </>:<Button appearance="primary" style={{backgroundColor:'var(--pt-danger)',borderColor:'var(--pt-danger)',color:'white'}} onClick={()=>setConfirming(true)}>Delete Takeoff</Button>}
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
  </div>;
}
