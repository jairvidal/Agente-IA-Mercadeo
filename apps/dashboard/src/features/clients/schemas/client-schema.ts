import { z } from "zod";

// ⚠️ ASSUMED SHAPE — pending validation with Yonathan
// See MOCK_CONTRACTS.md → ## [GET] /clients
export const clientSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  email: z.string().email().nullable(),
  company: z.string().max(120).nullable(),
  phone: z.string().max(40).nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  createdAt: z.string().datetime(),
  _count: z.object({ quotes: z.number().int().nonnegative() }),
});

export type Client = z.infer<typeof clientSchema>;
