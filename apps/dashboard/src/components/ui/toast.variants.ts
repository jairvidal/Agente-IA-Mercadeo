import { cva, type VariantProps } from "class-variance-authority";

export const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default:
          "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        destructive:
          "destructive group border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type ToastVariants = VariantProps<typeof toastVariants>;
