import { z } from "zod";

const DEV_DEFAULTS = {
  VITE_API_URL: "http://localhost:3001",
  VITE_ENV: "dev" as const,
};

const envSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_ENV: z.enum(["dev", "staging", "prod"]).default("dev"),
});

const raw = {
  VITE_API_URL: import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? DEV_DEFAULTS.VITE_API_URL : undefined),
  VITE_ENV: import.meta.env.VITE_ENV ?? (import.meta.env.DEV ? DEV_DEFAULTS.VITE_ENV : undefined),
};

const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors;
  const message =
    "Invalid VITE_* environment variables. Copy .env.example to .env. Errors: " +
    JSON.stringify(errors);

  console.error("[env]", errors);

  if (typeof document !== "undefined") {
    document.body.innerHTML = `<pre style="padding:24px;font-family:monospace;color:#b91c1c;white-space:pre-wrap">${message}</pre>`;
  }

  throw new Error(message);
}

export const env = parsed.data;
