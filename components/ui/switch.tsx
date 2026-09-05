"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/switch relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border bg-input/80 p-0.5 shadow-xs outline-none transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:bg-muted-foreground/30 data-checked:border-success/75 data-checked:bg-success data-checked:hover:bg-success/90 data-disabled:cursor-not-allowed data-disabled:opacity-45 data-focused:ring-2 data-focused:ring-ring/50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full bg-primary shadow-sm ring-1 ring-background/20 transition-transform duration-150 ease-out data-checked:translate-x-4"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
