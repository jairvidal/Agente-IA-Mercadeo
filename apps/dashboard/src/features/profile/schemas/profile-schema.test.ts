import { describe, expect, it } from "vitest";

import { profileSchema } from "./profile-schema";

describe("profileSchema", () => {
  const validPayload = {
    id: "dev",
    email: "dev@sidoc.co",
    name: "Dev User",
    createdAt: "2026-01-15T10:00:00.000Z",
  };

  it("accepts a valid payload", () => {
    const result = profileSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts a null name", () => {
    const result = profileSchema.safeParse({ ...validPayload, name: null });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = profileSchema.safeParse({ ...validPayload, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
    }
  });

  it("rejects a non-ISO createdAt", () => {
    const result = profileSchema.safeParse({ ...validPayload, createdAt: "2026-01-15" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["createdAt"]);
    }
  });

  it("rejects missing fields", () => {
    const { name: _name, ...withoutName } = validPayload;
    const result = profileSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["name"]);
    }
  });
});
