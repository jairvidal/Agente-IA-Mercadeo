import { cva, type VariantProps } from "class-variance-authority";

export const inputVariants = cva(
  "flex w-full rounded-lg border bg-background px-3 py-1.5 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-input text-foreground",
        error: "border-destructive text-foreground focus-visible:ring-destructive",
      },
      size: {
        default: "h-9",
        sm: "h-8 text-xs",
        lg: "h-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type InputVariants = VariantProps<typeof inputVariants>;
