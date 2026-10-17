'use client';

import {type ReactNode} from 'react';
import {Button,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger} from '@fluentui/react-components';
import {DismissRegular} from '@fluentui/react-icons';

export function ChangeOrderDetails({title,description,leading,trailing,children}:{title:string;description:string;leading:ReactNode;trailing:ReactNode;children:ReactNode}) {
  return <Dialog>
    <div className="carez-co-row flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="min-w-0">{leading}</div><div className="flex items-center gap-2">{trailing}<DialogTrigger disableButtonEnhancement><Button type="button" appearance="outline" size="small">View / Edit</Button></DialogTrigger></div></div>
    <DialogSurface className="pt-dialog"><DialogBody><div className="pt-dialog-heading"><DialogTitle>{title}</DialogTitle><DialogTrigger disableButtonEnhancement action="close"><Button type="button" appearance="subtle" aria-label="Close change order" icon={<DismissRegular/>}/></DialogTrigger></div><DialogContent><p className="mb-3 text-xs text-muted-foreground">{description}</p>{children}</DialogContent></DialogBody></DialogSurface>
  </Dialog>;
}
