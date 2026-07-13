"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground border shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) rounded-lg px-3 py-2 text-left text-xs leading-snug",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-popover fill-popover z-50 size-2.5 translate-y-[calc(-50%_-_3px)] rotate-45 rounded-[2px] border-r border-b border-border" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

/**
 * Corps structuré d'un tooltip Quantsightly : titre court + description alignée à
 * gauche + formule optionnelle (bloc monospace). À placer dans `<TooltipContent>`.
 */
function TooltipBody({
  title,
  formula,
  children,
}: {
  title?: string;
  formula?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1 text-left">
      {title && <div className="font-semibold">{title}</div>}
      {children && <div className="text-muted-foreground">{children}</div>}
      {formula && (
        <code className="mt-1.5 block rounded-md bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground/80">
          {formula}
        </code>
      )}
    </div>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipBody, TooltipProvider };
