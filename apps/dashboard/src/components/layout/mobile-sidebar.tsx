import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Sidebar } from "./sidebar";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 left-0 z-50 w-60 lg:hidden">
        <div className="relative flex h-full w-full flex-col bg-card">
          <div className="absolute right-3 top-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Cerrar menú"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <Sidebar
            isCollapsed={false}
            onToggle={() => {}}
            onNavigate={onClose}
            hideCollapseButton
          />
        </div>
      </div>
    </>
  );
}
