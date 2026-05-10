import { useState } from "react";
import { Menu } from "lucide-react";

import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";

import { Header } from "./header";
import { MobileSidebar } from "./mobile-sidebar";
import { Sidebar } from "./sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed, toggle, isHydrated } = useSidebarCollapse();

  const sidebarWidth = isCollapsed ? "lg:pl-[72px]" : "lg:pl-60";

  return (
    <div className="flex h-screen overflow-hidden">
      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {isHydrated && (
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col">
          <Sidebar isCollapsed={isCollapsed} onToggle={toggle} />
        </div>
      )}

      <div className={`flex flex-1 flex-col transition-all duration-300 ${sidebarWidth}`}>
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-x-4 border-b border-border bg-card px-4 sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg p-2 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Header />
        </header>

        <main className="flex-1 overflow-y-auto min-w-0 bg-background">
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
