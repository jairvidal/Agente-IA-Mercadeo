import { profileSchema, type Profile } from "../schemas/profile-schema";

// Mock delay simulated for validating loading states.
// Remove when real backend is deployed.
const MOCK_DELAY_MS = 400;

// Mock derived from STUB_SESSION (features/auth/api/auth-api.ts) so the profile
// stays visually coherent with the session while HU-FE-002 is paused.
let mockProfileState: Profile = {
  id: "dev",
  email: "dev@sidoc.co",
  name: "Dev User",
  createdAt: "2026-01-15T10:00:00.000Z",
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function fetchProfile(): Promise<Profile> {
  await delay(MOCK_DELAY_MS);
  return profileSchema.parse(mockProfileState);
}

// ⚠️ ASSUMED SHAPE — pending validation with Yonathan
export interface UpdateProfilePayload {
  name: string;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<Profile> {
  await delay(MOCK_DELAY_MS);
  mockProfileState = { ...mockProfileState, name: payload.name };
  return profileSchema.parse(mockProfileState);
}
