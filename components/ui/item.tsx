import type {ComponentProps} from 'react';
import {cn} from '@/lib/utils';

export function Item({className,...props}:ComponentProps<'div'> & {variant?:'outline';size?:'xs'}){
  const {variant:_variant,size:_size,...rest}=props;
  return <div data-slot="item" className={cn('flex min-h-[68px] items-center gap-3 rounded-md border border-border/80 bg-muted/30 px-3 py-3',className)} {...rest}/>;
}
export function ItemMedia({className,...props}:ComponentProps<'span'> & {variant?:'icon'}){
  const {variant:_variant,...rest}=props;
  return <span data-slot="item-media" className={cn('grid size-8 shrink-0 place-items-center rounded-sm border border-primary/15 bg-primary/10 text-primary',className)} {...rest}/>;
}
export function ItemContent({className,...props}:ComponentProps<'div'>){return <div data-slot="item-content" className={cn('min-w-0 flex-1',className)} {...props}/>;}
export function ItemTitle({className,...props}:ComponentProps<'div'>){return <div data-slot="item-title" className={cn('truncate text-sm font-semibold',className)} {...props}/>;}
export function ItemDescription({className,...props}:ComponentProps<'div'>){return <div data-slot="item-description" className={cn('mt-0.5 truncate text-xs text-muted-foreground',className)} {...props}/>;}
export function ItemActions({className,...props}:ComponentProps<'div'>){return <div data-slot="item-actions" className={cn('ml-auto flex shrink-0 items-center gap-2',className)} {...props}/>;}
