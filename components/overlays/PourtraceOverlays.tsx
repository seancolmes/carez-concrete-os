'use client';

import type { ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Popover,
  PopoverSurface,
  PopoverTrigger,
} from '@fluentui/react-components';
import { CheckmarkRegular, DismissRegular } from '@fluentui/react-icons';
import styles from './PourtraceOverlays.module.css';

type SharedProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  triggerClassName?: string;
};

export type PourtraceDialogVariant = 'decision' | 'review' | 'workflow';
export type PourtraceDrawerVariant = 'inspector' | 'tray' | 'ledger';
export type PourtraceMenuVariant = 'command' | 'row' | 'filter';
export type PourtracePopoverVariant = 'formula' | 'recommendation' | 'snapshot';

export function PourtraceDialog({ trigger, title, description, children, variant = 'decision', triggerClassName, open, onOpenChange }: Omit<SharedProps, 'trigger'> & { trigger?: ReactNode; variant?: PourtraceDialogVariant; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={(_, data) => onOpenChange?.(data.open)}>
    <>{trigger ? <DialogTrigger disableButtonEnhancement><Button className={triggerClassName || styles.trigger}>{trigger}</Button></DialogTrigger> : null}</>
    <DialogSurface className={`${styles.dialog} ${styles[`dialog_${variant}`]}`}>
      <DialogBody>
        <div className={styles.heading}>
          <div><DialogTitle className={styles.title}>{title}</DialogTitle>{description ? <p className={styles.description}>{description}</p> : null}</div>
          <DialogTrigger action="close"><Button appearance="subtle" icon={<DismissRegular />} className={styles.iconButton} aria-label="Close dialog" /></DialogTrigger>
        </div>
        <DialogContent className={styles.body}>{children}</DialogContent>
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}

export function PourtraceDrawer({ trigger, title, description, children, variant = 'inspector', triggerClassName }: SharedProps & { variant?: PourtraceDrawerVariant }) {
  return <Dialog>
    <DialogTrigger disableButtonEnhancement><Button className={triggerClassName || styles.trigger}>{trigger}</Button></DialogTrigger>
    <DialogSurface className={`${styles.drawer} ${styles[`drawer_${variant}`]}`}>
      <DialogBody>
        <div className={styles.heading}>
          <div><DialogTitle className={styles.title}>{title}</DialogTitle>{description ? <p className={styles.description}>{description}</p> : null}</div>
          <DialogTrigger action="close"><Button appearance="subtle" icon={<DismissRegular />} className={styles.iconButton} aria-label="Close drawer" /></DialogTrigger>
        </div>
        <DialogContent className={styles.body}>{children}</DialogContent>
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}

export type PourtraceMenuItem = { label: string; detail?: string; selected?: boolean; onSelect?: () => void; disabled?: boolean };

export function PourtraceMenu({ trigger, title, items, variant = 'command', triggerClassName }: { trigger: ReactNode; title?: string; items: PourtraceMenuItem[]; variant?: PourtraceMenuVariant; triggerClassName?: string }) {
  return <Menu>
    <MenuTrigger disableButtonEnhancement><Button className={triggerClassName || styles.trigger}>{trigger}</Button></MenuTrigger>
    <MenuPopover className={`${styles.menu} ${styles[`menu_${variant}`]}`}>
      <MenuList>
        {title ? <div className={styles.menuHeading}>{title}</div> : null}
        {items.map(item => <MenuItem key={item.label} disabled={item.disabled} onClick={item.onSelect} className={styles.menuItem} icon={item.selected ? <CheckmarkRegular className={styles.check} /> : undefined}>
          <span className={styles.menuItemCopy}><span>{item.label}</span>{item.detail ? <small>{item.detail}</small> : null}</span>
        </MenuItem>)}
      </MenuList>
    </MenuPopover>
  </Menu>;
}

export function PourtracePopover({ trigger, title, description, children, variant = 'formula', triggerClassName }: SharedProps & { variant?: PourtracePopoverVariant }) {
  return <Popover positioning="below-start">
    <PopoverTrigger disableButtonEnhancement><Button className={triggerClassName || styles.trigger}>{trigger}</Button></PopoverTrigger>
    <PopoverSurface className={`${styles.popover} ${styles[`popover_${variant}`]}`}>
      <div className={styles.popoverHeading}><div className={styles.title}>{title}</div>{description ? <p className={styles.description}>{description}</p> : null}</div>
      <div className={styles.popoverBody}>{children}</div>
    </PopoverSurface>
  </Popover>;
}
