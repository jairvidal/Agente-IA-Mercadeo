import { envSchema, parseEnv } from "./env-schema.ts";

export { parseEnv };
export type { Env } from "./env-schema.ts";

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const issues = result.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  console.error(`[env] Invalid environment variables:\n${issues}`);
  process.exit(1);
}

export const env = result.data;
