import { cva, type VariantProps } from "class-variance-authority";

export const dialogContentVariants = cva(
  "fixed left-[50%] top-[50%] z-50 grid translate-x-[-50%] translate-y-[-50%] gap-4 bg-[hsl(var(--background))] p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-[var(--radius)] border border-[hsl(var(--border))]",
  {
    variants: {
      size: {
        sm: "w-full max-w-sm",
        default: "w-full max-w-lg",
        lg: "w-full max-w-2xl",
        full: "w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export type DialogContentVariants = VariantProps<typeof dialogContentVariants>;
