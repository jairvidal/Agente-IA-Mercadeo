import { describe, expect, it } from "vitest";

import { clientSchema } from "./client-schema";

const validClient = {
  id: "client-1",
  name: "Alejandra Restrepo",
  email: "alejandra@example.com",
  company: "Inmobiliaria del Café",
  phone: "+57 300 123 4567",
  status: "ACTIVE" as const,
  createdAt: "2026-04-01T10:00:00.000Z",
  _count: { quotes: 3 },
};

describe("clientSchema", () => {
  it("parses a valid client", () => {
    expect(() => clientSchema.parse(validClient)).not.toThrow();
  });

  it("accepts null for email, company, and phone", () => {
    const withNulls = { ...validClient, email: null, company: null, phone: null };
    expect(() => clientSchema.parse(withNulls)).not.toThrow();
  });

  it("rejects when name is empty", () => {
    expect(() => clientSchema.parse({ ...validClient, name: "" })).toThrow();
  });

  it("rejects when email is not a valid email", () => {
    expect(() => clientSchema.parse({ ...validClient, email: "not-an-email" })).toThrow();
  });

  it("rejects unknown status values", () => {
    expect(() =>
      clientSchema.parse({ ...validClient, status: "PENDING" }),
    ).toThrow();
  });

  it("rejects when createdAt is not an ISO datetime", () => {
    expect(() =>
      clientSchema.parse({ ...validClient, createdAt: "not-a-date" }),
    ).toThrow();
  });

  it("rejects when _count.quotes is negative", () => {
    expect(() =>
      clientSchema.parse({ ...validClient, _count: { quotes: -1 } }),
    ).toThrow();
  });
});
