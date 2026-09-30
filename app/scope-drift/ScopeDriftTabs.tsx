'use client';

import { Children, useState, type ReactNode } from 'react';
import { Tab, TabList } from '@fluentui/react-components';

type ScopeDriftTab = 'signals' | 'reviewed' | 'record';
const tabOrder: ScopeDriftTab[] = ['record', 'signals', 'reviewed'];

export function ScopeDriftTabs({
  defaultTab,
  signalsCount,
  reviewedCount,
  children,
}: {
  defaultTab: ScopeDriftTab;
  signalsCount: number;
  reviewedCount: number;
  children: ReactNode;
}) {
  const [selectedTab, setSelectedTab] = useState<ScopeDriftTab>(defaultTab);
  const panels = Children.toArray(children);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 border border-border bg-card">
      <TabList
        aria-label="Scope drift views"
        selectedValue={selectedTab}
        onTabSelect={(_event, data) => setSelectedTab(data.value as ScopeDriftTab)}
        className="w-full shrink-0 px-2"
      >
        <Tab value="signals">New signals · {signalsCount}</Tab>
        <Tab value="reviewed">Reviewed · {reviewedCount}</Tab>
        <Tab value="record">Record field change</Tab>
      </TabList>
      {panels.map((panel, index) => (
        <div
          key={tabOrder[index]}
          role="tabpanel"
          hidden={selectedTab !== tabOrder[index]}
          className="min-h-0 flex-1 overflow-auto"
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
