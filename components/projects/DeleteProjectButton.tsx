'use client';

import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@fluentui/react-components';
import {deleteProject} from '@/app/projects/actions';

export function DeleteProjectButton({projectId,projectName}:{projectId:string;projectName:string}){
  const router=useRouter();
  const [confirming,setConfirming]=useState(false);
  const [error,setError]=useState('');
  const [pending,startTransition]=useTransition();
  return <div className="space-y-2">
    {confirming?<>
      <p className="text-sm text-muted-foreground">Permanently delete {projectName}? This cannot be undone. Protected linked records may prevent deletion.</p>
      <div className="flex gap-2">
        <Button appearance="primary" className="bg-destructive text-destructive-foreground" disabled={pending} onClick={()=>startTransition(async()=>{
          setError('');
          try{await deleteProject(projectId);router.push('/projects');router.refresh();}
          catch(cause){setError(cause instanceof Error?cause.message:'Project could not be deleted.');}
        })}>{pending?'Deleting…':'Confirm deletion'}</Button>
        <Button appearance="outline" disabled={pending} onClick={()=>{setConfirming(false);setError('');}}>Cancel</Button>
      </div>
    </>:<Button appearance="outline" className="text-destructive" onClick={()=>setConfirming(true)}>Delete Project</Button>}
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
  </div>;
}
