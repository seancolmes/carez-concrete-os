'use client';

import {useState, type ReactNode} from 'react';
import {Tab, TabList} from '@fluentui/react-components';
import styles from './ReportsTabs.module.css';

type ReportView = 'jobs' | 'production' | 'current';

export function ReportsTabs({children}:{children:ReactNode}){
  const [view,setView]=useState<ReportView>('jobs');

  return <div className={styles.root} data-view={view}>
    <TabList aria-label="Report views" selectedValue={view} onTabSelect={(_,data)=>setView(data.value as ReportView)} className={styles.tabList}>
      <Tab value="jobs">Job scorecards</Tab>
      <Tab value="production">Production rates</Tab>
      <Tab value="current">Current work</Tab>
    </TabList>
    <div className={styles.panes}>{children}</div>
  </div>;
}
