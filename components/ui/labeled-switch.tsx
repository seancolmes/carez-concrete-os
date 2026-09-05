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
  ...props
}: LabeledSwitchProps) {
  return (
    <div
      data-slot="labeled-switch"
      data-disabled={disabled ? "true" : undefined}
      className={cn(
        "flex min-h-9 items-center justify-between gap-3 rounded-md border border-input bg-background px-2.5 py-1.5",
        className
      )}
    >
      <Label
        htmlFor={id}
        className={cn(
          "min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left text-[11px] leading-tight text-foreground",
          disabled && "cursor-not-allowed opacity-50",
          labelClassName
        )}
      >
        <span>{label}</span>
        {description ? (
          <span className="text-[9px] font-normal leading-tight text-muted-foreground">
            {description}
          </span>
        ) : null}
      </Label>
      <Switch id={id} disabled={disabled} {...props} />
    </div>
  )
}

export { LabeledSwitch }
