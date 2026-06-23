"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Variante "frosted" du DialogContent shadcn :
 *  - Overlay plus opaque (bg-black/70) + backdrop-blur léger → effet verre dépoli
 *  - bg-popover au lieu de bg-background → contraste avec la page en dark mode
 *  - shadow-2xl par défaut
 *
 * N'altère pas le composant shadcn d'origine — réutilise simplement
 * son DialogPortal + DialogOverlay et substitue uniquement le Content.
 */
function FrostedDialogContent({
  className,
  children,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay className="bg-black/70 backdrop-blur-sm" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)]",
          "translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-popover p-6 shadow-2xl",
          "duration-200 outline-none",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export { FrostedDialogContent };

// Re-export shadcn pour qu'un consommateur n'ait qu'un seul import à faire.
export {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
