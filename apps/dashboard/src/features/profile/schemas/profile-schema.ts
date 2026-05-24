import { z } from "zod";

// ⚠️ ASSUMED SHAPE — pending validation with Yonathan
export const profileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type Profile = z.infer<typeof profileSchema>;
