import Link from 'next/link';
import styles from './design-lab.module.css';

export default function DesignLabPage(){
  return <main className={styles.labIndex}>
    <div className={styles.labIndexPanel}>
      <div className={styles.labEyebrow}>CAREZ CONCRETE OS</div>
      <h1>UI Design Lab</h1>
      <p>Browser-rendered product design surfaces using local mock data only. Nothing here writes to Supabase or production workflows.</p>
      <div className={styles.labIndexList}>
        <Link href="/design-lab/estimating/scope">
          <span>Estimating</span>
          <strong>E1 — Scope</strong>
          <small>Active design surface</small>
        </Link>
        <div className={styles.labIndexPlaceholder}><span>Takeoff</span><strong>Workstation</strong><small>Next</small></div>
        <div className={styles.labIndexPlaceholder}><span>CRM / Preconstruction</span><strong>Bid Board</strong><small>Planned</small></div>
        <div className={styles.labIndexPlaceholder}><span>Projects</span><strong>Work Packages</strong><small>Planned</small></div>
      </div>
    </div>
  </main>;
}
