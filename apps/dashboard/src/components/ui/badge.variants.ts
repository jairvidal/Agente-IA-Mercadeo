import { cva, type VariantProps } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
  {
    variants: {
      variant: {
        default: "bg-gray-50 text-gray-600 border-gray-200",
        success: "bg-emerald-50 text-emerald-700 border-emerald-200",
        warning: "bg-amber-50 text-amber-700 border-amber-200",
        error: "bg-rose-50 text-rose-700 border-rose-200",
        blue: "bg-blue-50 text-blue-700 border-blue-200",
        violet: "bg-violet-50 text-violet-700 border-violet-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
