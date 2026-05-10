import { useState } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/hooks/use-session";
import { apiClient, ApiError } from "@/lib/api";

import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const { data: session } = useSession();

  return (
    <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
      <div className="flex flex-1" />
      <div className="flex items-center gap-x-1 lg:gap-x-2">
        <ThemeToggle />
        {session && <UserMenu user={session} />}
      </div>
    </div>
  );
}

interface User {
  id: string;
  email: string;
  name: string | null;
}

function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (err) {
      // Ignore network/auth errors on logout — client should still be cleared.
      if (!(err instanceof ApiError)) throw err;
    }
    queryClient.clear();
    navigate({ to: "/login" });
  };

  const displayName = user.name ?? user.email;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
          {initials}
        </div>
        <span className="hidden sm:inline">{displayName}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-50 mt-1.5 w-52 rounded-xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground truncate">
                {user.name ?? "Usuario"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <div className="p-1">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
