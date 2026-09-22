"use client"

import * as React from "react"
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

function NavigationMenu({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Root>) {
  return <NavigationMenuPrimitive.Root data-slot="navigation-menu" className={cn("relative flex max-w-max flex-1 items-center justify-center", className)} {...props} />
}

function NavigationMenuList({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return <NavigationMenuPrimitive.List data-slot="navigation-menu-list" className={cn("flex flex-1 list-none items-center gap-0.5", className)} {...props} />
}

function NavigationMenuItem({ ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return <NavigationMenuPrimitive.Item data-slot="navigation-menu-item" {...props} />
}

function navigationMenuTriggerStyle(className?: string) {
  return cn("group inline-flex h-9 w-max items-center justify-center border-b-2 border-transparent px-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:border-primary data-[state=open]:text-foreground", className)
}

function NavigationMenuTrigger({ className, children, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return <NavigationMenuPrimitive.Trigger data-slot="navigation-menu-trigger" className={navigationMenuTriggerStyle(className)} {...props}>{children}<ChevronDown className="relative top-px ml-1 size-3 transition-transform duration-150 group-data-[state=open]:rotate-180" aria-hidden="true" /></NavigationMenuPrimitive.Trigger>
}

function NavigationMenuContent({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return <NavigationMenuPrimitive.Content data-slot="navigation-menu-content" className={cn("absolute top-0 left-0 w-max max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-sm outline-none data-[motion=from-end]:animate-in data-[motion=from-end]:fade-in-0 data-[motion=from-start]:animate-in data-[motion=from-start]:fade-in-0 data-[motion=to-end]:animate-out data-[motion=to-end]:fade-out-0 data-[motion=to-start]:animate-out data-[motion=to-start]:fade-out-0", className)} {...props} />
}

function NavigationMenuLink({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return <NavigationMenuPrimitive.Link data-slot="navigation-menu-link" className={cn("block rounded-sm px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/50", className)} {...props} />
}

function NavigationMenuViewport({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  return <div className={cn("absolute top-full left-0 flex w-full max-w-[calc(100vw-2rem)] justify-center")}><NavigationMenuPrimitive.Viewport data-slot="navigation-menu-viewport" className={cn("relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full max-w-[calc(100vw-2rem)] origin-top overflow-hidden rounded-md bg-popover transition-[width,height] duration-200 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:zoom-in-95 sm:w-[var(--radix-navigation-menu-viewport-width)]", className)} {...props} /></div>
}

export { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, NavigationMenuViewport, navigationMenuTriggerStyle }
