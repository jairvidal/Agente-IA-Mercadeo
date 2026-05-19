import { apiClient } from "@/lib/api";

import type { LoginInput } from "../schemas/login-schema";

export interface Session {
  id: string;
  email: string;
  name: string | null;
}

const STUB_SESSION: Session = {
  id: "dev",
  email: "dev@sidoc.co",
  name: "Dev User",
};

export function login(input: LoginInput) {
  return apiClient.post<unknown>("/auth/login", input);
}

export function refreshToken() {
  return apiClient.post<unknown>("/auth/refresh");
}

export async function fetchSession(): Promise<Session | null> {
  return STUB_SESSION;
}
