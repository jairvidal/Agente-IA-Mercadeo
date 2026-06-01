import { clientSchema, type Client } from "../schemas/client-schema";

// ⚠️ ASSUMED SHAPE — pending validation with Yonathan
// See MOCK_CONTRACTS.md → ## [POST] /clients
export interface ClientCreatePayload {
  name: string;
  email: string;
  company: string;
  phone: string;
}

// ⚠️ ASSUMED SHAPE — pending validation with Yonathan
// See MOCK_CONTRACTS.md → ## [PATCH] /clients/:id
export type ClientUpdatePayload = Partial<ClientCreatePayload>;

const MOCK_DELAY_MS = 400;

const INITIAL_SEED: Client[] = [
  {
    id: "client-1",
    name: "Alejandra Restrepo",
    email: "alejandra.restrepo@gmail.com",
    company: "Inmobiliaria del Café",
    phone: "+57 300 412 5678",
    status: "ACTIVE",
    createdAt: "2026-03-29T09:15:00.000Z",
    _count: { quotes: 12 },
  },
  {
    id: "client-2",
    name: "Bernardo Quintero",
    email: "bernardo.q@aceros-andinos.co",
    company: "Aceros Andinos S.A.S.",
    phone: null,
    status: "ACTIVE",
    createdAt: "2026-04-02T14:30:00.000Z",
    _count: { quotes: 5 },
  },
  {
    id: "client-3",
    name: "Camila Ñungo",
    email: "cnungo@hotmail.com",
    company: "Constructora Ñandú",
    phone: "+57 301 223 4455",
    status: "INACTIVE",
    createdAt: "2026-04-05T08:45:00.000Z",
    _count: { quotes: 1 },
  },
  {
    id: "client-4",
    name: "Daniela Torres",
    email: "dani.torres@outlook.com",
    company: null,
    phone: "+57 304 567 8910",
    status: "ACTIVE",
    createdAt: "2026-04-08T11:20:00.000Z",
    _count: { quotes: 0 },
  },
  {
    id: "client-5",
    name: "Esteban Marín",
    email: null,
    company: "Logística del Valle S.A.S.",
    phone: "+57 310 234 5678",
    status: "ACTIVE",
    createdAt: "2026-04-11T16:00:00.000Z",
    _count: { quotes: 2 },
  },
  {
    id: "client-6",
    name: "Felipe Cárdenas",
    email: "fcardenas@grupo-cardenas.com",
    company: "Grupo Cárdenas",
    phone: null,
    status: "ACTIVE",
    createdAt: "2026-04-14T10:10:00.000Z",
    _count: { quotes: 4 },
  },
  {
    id: "client-7",
    name: "Gabriela Rojas",
    email: "gabriela.rojas@gmail.com",
    company: null,
    phone: "+57 313 456 7890",
    status: "ACTIVE",
    createdAt: "2026-04-17T13:25:00.000Z",
    _count: { quotes: 1 },
  },
  {
    id: "client-8",
    name: "Héctor Vega",
    email: "hector.vega@hotmail.com",
    company: "Distribuciones Vega Ltda.",
    phone: "+57 315 678 9012",
    status: "ACTIVE",
    createdAt: "2026-04-20T09:50:00.000Z",
    _count: { quotes: 7 },
  },
  {
    id: "client-9",
    name: "Isabel Castaño",
    email: "icastano@outlook.com",
    company: "Comercializadora Andina S.A.",
    phone: "+57 317 789 0123",
    status: "INACTIVE",
    createdAt: "2026-04-23T15:40:00.000Z",
    _count: { quotes: 3 },
  },
  {
    id: "client-10",
    name: "Juan Diego Ríos",
    email: "juan.rios@rios-y-cia.co",
    company: "Ríos & Cía.",
    phone: "+57 318 890 1234",
    status: "ACTIVE",
    createdAt: "2026-04-26T12:15:00.000Z",
    _count: { quotes: 8 },
  },
  {
    id: "client-11",
    name: "Karen Patiño",
    email: null,
    company: null,
    phone: "+57 320 901 2345",
    status: "INACTIVE",
    createdAt: "2026-04-29T17:30:00.000Z",
    _count: { quotes: 0 },
  },
  {
    id: "client-12",
    name: "Luis Mauricio Gómez",
    email: "lmgomez@gmail.com",
    company: "Aceros del Valle",
    phone: "+57 321 012 3456",
    status: "ACTIVE",
    createdAt: "2026-05-02T08:00:00.000Z",
    _count: { quotes: 11 },
  },
  {
    id: "client-13",
    name: "Mariana Bedoya",
    email: "mariana.b@gmail.com",
    company: null,
    phone: "+57 311 123 4567",
    status: "ACTIVE",
    createdAt: "2026-05-05T14:45:00.000Z",
    _count: { quotes: 2 },
  },
  {
    id: "client-14",
    name: "Nicolás Vásquez",
    email: null,
    company: "Industrias Vásquez S.A.S.",
    phone: "+57 312 234 5678",
    status: "ACTIVE",
    createdAt: "2026-05-08T11:00:00.000Z",
    _count: { quotes: 0 },
  },
  {
    id: "client-15",
    name: "Olga Sánchez",
    email: "osanchez@hotmail.com",
    company: "Inversiones Sánchez",
    phone: "+57 313 345 6789",
    status: "INACTIVE",
    createdAt: "2026-05-11T09:30:00.000Z",
    _count: { quotes: 6 },
  },
  {
    id: "client-16",
    name: "Patricia Zuluaga",
    email: null,
    company: null,
    phone: "+57 314 456 7890",
    status: "INACTIVE",
    createdAt: "2026-05-14T16:20:00.000Z",
    _count: { quotes: 1 },
  },
  {
    id: "client-17",
    name: "Raúl Salazar",
    email: "raul.salazar@salazar-construcciones.co",
    company: "Salazar Construcciones",
    phone: null,
    status: "ACTIVE",
    createdAt: "2026-05-18T13:10:00.000Z",
    _count: { quotes: 4 },
  },
  {
    id: "client-18",
    name: "Yolanda Pérez",
    email: "yolanda.perez@outlook.com",
    company: null,
    phone: "+57 316 567 8901",
    status: "ACTIVE",
    createdAt: "2026-05-22T10:55:00.000Z",
    _count: { quotes: 3 },
  },
];

// Module-level mock state.
// Persists across navigations within the same session, but resets on:
//   - Full page reload (F5)
//   - Vite HMR reload of this file
//   - Test isolation (each test file gets a fresh module instance, plus tests
//     call resetMockState() in beforeEach)
// This is intentional for a simple mock. Replace with real backend when wired.
let mockClientsState: Client[] = [...INITIAL_SEED];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function fetchClients(): Promise<Client[]> {
  await delay(MOCK_DELAY_MS);
  return mockClientsState.map((c) => clientSchema.parse(c));
}

export async function fetchClientById(id: string): Promise<Client> {
  await delay(MOCK_DELAY_MS);
  const found = mockClientsState.find((c) => c.id === id);
  if (!found) {
    throw new Error(`Client with id "${id}" not found`);
  }
  return clientSchema.parse(found);
}

export async function createClient(payload: ClientCreatePayload): Promise<Client> {
  await delay(MOCK_DELAY_MS);
  const newClient: Client = {
    id: crypto.randomUUID(),
    name: payload.name.trim(),
    email: emptyToNull(payload.email),
    company: emptyToNull(payload.company),
    phone: emptyToNull(payload.phone),
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    _count: { quotes: 0 },
  };
  mockClientsState = [...mockClientsState, newClient];
  return clientSchema.parse(newClient);
}

export async function updateClient(
  id: string,
  payload: ClientUpdatePayload,
): Promise<Client> {
  await delay(MOCK_DELAY_MS);
  const index = mockClientsState.findIndex((c) => c.id === id);
  if (index === -1) {
    throw new Error(`Client with id "${id}" not found`);
  }
  const previous = mockClientsState[index];
  const updated: Client = {
    ...previous,
    ...(payload.name !== undefined && { name: payload.name.trim() }),
    ...(payload.email !== undefined && { email: emptyToNull(payload.email) }),
    ...(payload.company !== undefined && { company: emptyToNull(payload.company) }),
    ...(payload.phone !== undefined && { phone: emptyToNull(payload.phone) }),
  };
  mockClientsState = mockClientsState.map((c, i) => (i === index ? updated : c));
  return clientSchema.parse(updated);
}

export async function deleteClient(id: string): Promise<void> {
  await delay(MOCK_DELAY_MS);
  const exists = mockClientsState.some((c) => c.id === id);
  if (!exists) {
    throw new Error(`Client with id "${id}" not found`);
  }
  mockClientsState = mockClientsState.filter((c) => c.id !== id);
}

// Exported only for test isolation. Restores the in-memory state to the initial
// seed so tests are independent. Not meant to be called from production code.
export function resetMockState(): void {
  mockClientsState = [...INITIAL_SEED];
}
