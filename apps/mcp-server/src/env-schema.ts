import { z } from "zod";

export const envSchema = z.object({
  MCP_SERVER_PORT: z.coerce.number().int().positive(),
  PROJECT_NAME: z.string().min(1),
  MCP_INTERNAL_TOKEN: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, string | undefined>): Env =>
  envSchema.parse(raw);
