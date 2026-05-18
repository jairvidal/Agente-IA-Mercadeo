import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Target,
  UserCircle,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Target },
  { label: "Clientes", href: "/clients", icon: Users },
  { label: "Cotizaciones", href: "/quotes", icon: FileText },
  { label: "Perfil", href: "/profile", icon: UserCircle },
] as const;

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  hideCollapseButton?: boolean;
}

export function Sidebar({
  isCollapsed,
  onToggle,
  onNavigate,
  hideCollapseButton,
}: SidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div
      className={cn(
        "relative flex h-full flex-col gap-y-5 bg-sidebar-bg border-r border-sidebar-border py-4 transition-all duration-300",
        isCollapsed ? "px-2 w-[72px]" : "px-3 w-60",
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-center">
        <Link to="/dashboard" onClick={onNavigate} aria-label="Sidoc — ir al dashboard">
          {isCollapsed ? (
            <img
              src="/favicon.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-9 object-contain"
            />
          ) : (
            <img
              src="/sidoc-logo.png"
              alt="Sidoc"
              className="h-10 w-auto object-contain px-2"
            />
          )}
        </Link>
      </div>

      {!hideCollapseButton && (
        <button
          onClick={onToggle}
          className={cn(
            "absolute -right-3 top-[72px] z-50 flex h-6 w-6 items-center justify-center rounded-full",
            "border border-border bg-card shadow-soft transition-colors hover:bg-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      )}

      <nav className="flex flex-1 flex-col px-1">
        <ul role="list" className="flex flex-1 flex-col gap-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex gap-x-3 rounded-lg px-2.5 py-2 text-[13px] font-medium leading-6 transition-colors",
                    isActive
                      ? "bg-primary text-white"
                      : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active",
                    isCollapsed && "justify-center px-2",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
