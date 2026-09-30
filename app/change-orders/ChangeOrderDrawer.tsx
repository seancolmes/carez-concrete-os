'use client';

import { useState, type ReactNode } from 'react';
import { Button, DrawerBody, DrawerHeader, DrawerHeaderTitle, OverlayDrawer } from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';

export function ChangeOrderDrawer({
  title,
  description,
  leading,
  trailing,
  children,
}: {
  title: string;
  description: string;
  leading: ReactNode;
  trailing: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="carez-co-row flex flex-wrap items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">{leading}</div>
        <div className="flex items-center gap-2">
          {trailing}
          <Button appearance="secondary" size="small" onClick={() => setOpen(true)}>View / Edit</Button>
        </div>
      </div>
      <OverlayDrawer
        position="end"
        open={open}
        onOpenChange={(_event, data) => setOpen(data.open)}
        className="!w-full sm:!max-w-3xl"
      >
        <DrawerHeader>
          <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close change order" icon={<DismissRegular />} onClick={() => setOpen(false)} />}>
            {title}
          </DrawerHeaderTitle>
          <p className="text-xs text-muted-foreground">{description}</p>
        </DrawerHeader>
        <DrawerBody>{children}</DrawerBody>
      </OverlayDrawer>
    </>
  );
}
