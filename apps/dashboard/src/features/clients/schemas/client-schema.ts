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

// ⚠️ ASSUMED SHAPE — pending validation with Yonathan
// See MOCK_CONTRACTS.md → ## [POST] /clients
// Validation rules (max lengths, exact wording, empty-string-as-no-value)
// are assumptions chosen so the form UX matches what the mock api stores.
export const clientCreateSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(120, "Máximo 120 caracteres"),
  email: z
    .string()
    .email("Email inválido")
    .or(z.literal("")),
  company: z.string().max(120, "Máximo 120 caracteres").or(z.literal("")),
  phone: z.string().max(40, "Máximo 40 caracteres").or(z.literal("")),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

// ⚠️ ASSUMED SHAPE — pending validation with Yonathan
// See MOCK_CONTRACTS.md → ## [PATCH] /clients/:id
// Edit allows partial updates: only the fields the user actually touched
// need to be validated.
export const clientUpdateSchema = clientCreateSchema.partial();

export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
