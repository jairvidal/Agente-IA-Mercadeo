import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "dashboard-sidebar-collapsed";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const getSnapshot = () => localStorage.getItem(STORAGE_KEY) === "true";
const getServerSnapshot = () => false;

export function useSidebarCollapse() {
  const isCollapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !getSnapshot();
    localStorage.setItem(STORAGE_KEY, String(next));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return { isCollapsed, toggle, isHydrated: true };
}
