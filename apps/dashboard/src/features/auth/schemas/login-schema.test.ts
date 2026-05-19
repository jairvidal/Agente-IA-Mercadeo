import { describe, expect, it } from "vitest";

import { loginSchema } from "./login-schema";

describe("loginSchema", () => {
  it("accepts a valid payload", () => {
    const result = loginSchema.safeParse({ email: "user@sidoc.co", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
      expect(result.error.issues[0]?.message).toBe("El email es obligatorio");
    }
  });

  it("rejects malformed email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
      expect(result.error.issues[0]?.message).toBe("Email inválido");
    }
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "user@sidoc.co", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["password"]);
      expect(result.error.issues[0]?.message).toBe("La contraseña es obligatoria");
    }
  });
});
