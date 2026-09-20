import Link from 'next/link';
import {CarezStatus} from '@/components/carez';
import {buttonVariants} from '@/components/ui/button';
import styles from '@/app/takeoff/[setId]/TakeoffDrawingPage.module.css';

type TakeoffWorkspaceIdentityProps={
  takeoffName:string;
  estimateId:string;
  estimateLabel:string;
  estimateStatus:string;
  revisionLabel?:string|null;
  project?:{id:string;jobNumber:string;name:string}|null;
  sheetCount:number;
  conditionCount:number;
  holdCount:number;
  locked:boolean;
};

export function TakeoffWorkspaceIdentity(props:TakeoffWorkspaceIdentityProps){
  return <header className={styles.identityStrip} data-slot="takeoff-workspace-identity">
    <div className={styles.identity}>
      <div className={styles.identityTitleGroup}>
        <p className={styles.eyebrow}>Takeoff</p>
        <h1 className={styles.title}>{props.takeoffName}</h1>
      </div>
      <div className={styles.meta}>
        <span className={styles.estimate}>{props.estimateLabel}</span>
        {props.revisionLabel?<span className={styles.revision}>· {props.revisionLabel}</span>:null}
        <CarezStatus tone="neutral" label={props.estimateStatus}/>
        {props.project?<span className={styles.project}>{props.project.jobNumber} · {props.project.name}</span>:null}
        <span className={styles.counts}>{props.sheetCount} sheets · {props.conditionCount} conditions · {props.holdCount} holds</span>
      </div>
    </div>
    <div className={styles.identityActions}>
      {props.locked?<CarezStatus tone="blocked" label="Read only"/>:null}
      <Link className={buttonVariants({variant:'outline',size:'xs'})} href={`/estimates/${props.estimateId}`}>Open Estimate</Link>
      {props.project?<Link className={buttonVariants({variant:'outline',size:'xs'})} href={`/projects/${props.project.id}`}>Open Project</Link>:null}
    </div>
  </header>;
}
