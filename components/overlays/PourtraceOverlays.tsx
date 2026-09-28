'use client';

import type { ReactNode } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { Check, X } from 'lucide-react';
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
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    {trigger ? <DialogPrimitive.Trigger className={triggerClassName || styles.trigger}>{trigger}</DialogPrimitive.Trigger> : null}
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={styles.backdrop} />
      <DialogPrimitive.Popup className={`${styles.dialog} ${styles[`dialog_${variant}`]}`}>
        <div className={styles.heading}>
          <div><DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>{description ? <DialogPrimitive.Description className={styles.description}>{description}</DialogPrimitive.Description> : null}</div>
          <DialogPrimitive.Close className={styles.iconButton} aria-label="Close dialog"><X size={18} /></DialogPrimitive.Close>
        </div>
        <div className={styles.body}>{children}</div>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export function PourtraceDrawer({ trigger, title, description, children, variant = 'inspector', triggerClassName }: SharedProps & { variant?: PourtraceDrawerVariant }) {
  return <DialogPrimitive.Root>
    <DialogPrimitive.Trigger className={triggerClassName || styles.trigger}>{trigger}</DialogPrimitive.Trigger>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={styles.backdrop} />
      <DialogPrimitive.Popup className={`${styles.drawer} ${styles[`drawer_${variant}`]}`}>
        <div className={styles.heading}>
          <div><DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>{description ? <DialogPrimitive.Description className={styles.description}>{description}</DialogPrimitive.Description> : null}</div>
          <DialogPrimitive.Close className={styles.iconButton} aria-label="Close drawer"><X size={18} /></DialogPrimitive.Close>
        </div>
        <div className={styles.body}>{children}</div>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export type PourtraceMenuItem = { label: string; detail?: string; selected?: boolean; onSelect?: () => void; disabled?: boolean };

export function PourtraceMenu({ trigger, title, items, variant = 'command', triggerClassName }: { trigger: ReactNode; title?: string; items: PourtraceMenuItem[]; variant?: PourtraceMenuVariant; triggerClassName?: string }) {
  return <MenuPrimitive.Root>
    <MenuPrimitive.Trigger className={triggerClassName || styles.trigger}>{trigger}</MenuPrimitive.Trigger>
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner side="bottom" align="start" sideOffset={8} className={styles.positioner}>
        <MenuPrimitive.Popup className={`${styles.menu} ${styles[`menu_${variant}`]}`}>
          {title ? <div className={styles.menuHeading}>{title}</div> : null}
          {items.map(item => <MenuPrimitive.Item key={item.label} disabled={item.disabled} onClick={item.onSelect} className={styles.menuItem}>
            <span className={styles.menuItemCopy}><span>{item.label}</span>{item.detail ? <small>{item.detail}</small> : null}</span>
            {item.selected ? <Check size={15} className={styles.check} aria-hidden="true" /> : null}
          </MenuPrimitive.Item>)}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  </MenuPrimitive.Root>;
}

export function PourtracePopover({ trigger, title, description, children, variant = 'formula', triggerClassName }: SharedProps & { variant?: PourtracePopoverVariant }) {
  return <PopoverPrimitive.Root>
    <PopoverPrimitive.Trigger className={triggerClassName || styles.trigger}>{trigger}</PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={10} className={styles.positioner}>
        <PopoverPrimitive.Popup className={`${styles.popover} ${styles[`popover_${variant}`]}`}>
          <div className={styles.popoverHeading}><PopoverPrimitive.Title className={styles.title}>{title}</PopoverPrimitive.Title>{description ? <PopoverPrimitive.Description className={styles.description}>{description}</PopoverPrimitive.Description> : null}</div>
          <div className={styles.popoverBody}>{children}</div>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}
