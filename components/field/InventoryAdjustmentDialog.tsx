'use client';
import type {ReactNode} from 'react';
import {Button,Dialog,DialogActions,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger} from '@fluentui/react-components';
export function InventoryAdjustmentDialog({name,children}:{name:string;children:ReactNode}){
 return <Dialog><DialogTrigger disableButtonEnhancement><Button appearance="outline" size="small">Adjust</Button></DialogTrigger><DialogSurface className="pt-dialog"><DialogBody><DialogTitle>Adjust {name}</DialogTitle><DialogContent className="pt-dialog-content"><p className="mb-3 text-sm text-muted-foreground">Record stock used, returned, or corrected.</p>{children}</DialogContent><DialogActions><DialogTrigger action="close" disableButtonEnhancement><Button type="button" appearance="outline">Cancel</Button></DialogTrigger></DialogActions></DialogBody></DialogSurface></Dialog>;
}
