"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/switch relative inline-flex h-5 w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input/70 p-0.5 shadow-xs outline-none transition-[background-color,box-shadow] duration-150 ease-out data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focused:ring-2 data-focused:ring-ring/50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform duration-150 ease-out data-checked:translate-x-3"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
