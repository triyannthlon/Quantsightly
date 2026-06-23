import { ReactNode } from "react";
import { ThemeToggle } from "@/components/custom/header/theme-toggle";

export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      {children}
      <div className="fixed bottom-4 right-4 z-50">
        <ThemeToggle />
      </div>
    </main>
  );
}
