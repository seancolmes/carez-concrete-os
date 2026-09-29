'use client';

import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {deleteProject} from '@/app/projects/actions';
import {Button} from '@/components/ui/button';

export function DeleteProjectButton({projectId,projectName}:{projectId:string;projectName:string}){
  const router=useRouter();
  const [confirming,setConfirming]=useState(false);
  const [error,setError]=useState('');
  const [pending,startTransition]=useTransition();
  return <div className="space-y-2">
    {confirming?<>
      <p className="text-sm text-muted-foreground">Permanently delete {projectName}? This cannot be undone. Protected linked records may prevent deletion.</p>
      <div className="flex gap-2">
        <Button variant="destructive" disabled={pending} onClick={()=>startTransition(async()=>{
          setError('');
          try{await deleteProject(projectId);router.push('/projects');router.refresh();}
          catch(cause){setError(cause instanceof Error?cause.message:'Project could not be deleted.');}
        })}>{pending?'Deleting…':'Confirm deletion'}</Button>
        <Button variant="outline" disabled={pending} onClick={()=>{setConfirming(false);setError('');}}>Cancel</Button>
      </div>
    </>:<Button variant="destructive" onClick={()=>setConfirming(true)}>Delete Project</Button>}
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
  </div>;
}
