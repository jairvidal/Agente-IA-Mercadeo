import * as React from "react";

import { cn } from "@/lib/utils";
import { inputVariants, type InputVariants } from "./input.variants";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    InputVariants {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(inputVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
