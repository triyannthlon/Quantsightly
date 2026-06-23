"use client";

import * as React from "react";

type HoverMenuCtx = {
  openKey: string | null;
  open: (key: string) => void;
  close: () => void;
  isOpen: (key: string) => boolean;
};

const HoverMenuContext = React.createContext<HoverMenuCtx | null>(null);

/************** HoverMenuProvider *****/
export function HoverMenuProvider({ children }: { children: React.ReactNode }) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  const closeTimer = React.useRef<number | null>(null);

  const clear = React.useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const open = React.useCallback(
    (key: string) => {
      clear();
      setOpenKey(key);
    },
    [clear],
  );

  const close = React.useCallback(() => {
    clear();
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 120);
  }, [clear]);

  const isOpen = React.useCallback((key: string) => openKey === key, [openKey]);

  const value = React.useMemo(
    () => ({ openKey, open, close, isOpen }),
    [openKey, open, close, isOpen],
  );

  return <HoverMenuContext.Provider value={value}>{children}</HoverMenuContext.Provider>;
}

/************** useHoverMenu *****/
export function useHoverMenu() {
  const ctx = React.useContext(HoverMenuContext);
  if (!ctx) throw new Error("useHoverMenu must be used within HoverMenuProvider");
  return ctx;
}
