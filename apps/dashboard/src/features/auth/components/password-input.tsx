import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";

interface PasswordInputProps extends Omit<ComponentPropsWithoutRef<typeof Input>, "type"> {
  hasError?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ hasError, className, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={`pr-10 ${className ?? ""}`.trim()}
          variant={hasError ? "error" : "default"}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-lg"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
