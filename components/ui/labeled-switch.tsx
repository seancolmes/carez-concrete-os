"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type LabeledSwitchProps = Omit<React.ComponentProps<typeof Switch>, "id"> & {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  className?: string
  labelClassName?: string
}

function LabeledSwitch({
  id,
  label,
  description,
  className,
  labelClassName,
  disabled,
  checked,
  ...props
}: LabeledSwitchProps) {
  return (
    <div
      data-slot="labeled-switch"
      data-disabled={disabled ? "true" : undefined}
      data-checked={checked ? "true" : "false"}
      className={cn(
        "flex min-h-10 items-center justify-between gap-3 rounded-md border border-input bg-background px-2.5 py-1.5 transition-[background-color,border-color] data-[checked=true]:border-success/45 data-[checked=true]:bg-success/5",
        className
      )}
    >
      <Label
        htmlFor={id}
        className={cn(
          "min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left text-xs font-medium leading-4 text-foreground",
          disabled && "cursor-not-allowed opacity-50",
          labelClassName
        )}
      >
        <span>{label}</span>
        {description ? (
          <span className="text-[10px] font-normal leading-4 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </Label>
      <Switch id={id} checked={checked} disabled={disabled} {...props} />
    </div>
  )
}

export { LabeledSwitch }
