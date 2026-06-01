# MOCK_CONTRACTS

> Documento de shapes de API asumidos por el frontend antes de que el backend confirme.
> Cada vez que el frontend mockea un endpoint y asume un shape, se documenta acá.
> Cuando el backend implemente el endpoint real, se valida contra este doc.

## Convención de marcadores

- `⏳ pending` — Shape asumido por frontend, backend no ha confirmado todavía.
- `✅ confirmed` — Shape verificado contra implementación backend real.
- `⚠️ divergent` — Backend implementó algo distinto al asumido. Requiere ajuste frontend.

## Cómo agregar una entrada

Cada endpoint tiene su sección con:

1. Método + ruta
2. Status (pending / confirmed / divergent)
3. Fecha primera asunción
4. Request payload (si aplica) — shape Zod o TypeScript
5. Response — shape Zod o TypeScript
6. Archivos que usan este shape (paths exactos + líneas aprox)
7. Notas / preguntas para backend
8. Trazabilidad: HU + commit donde se introdujo

---

## Endpoints

### [GET] /clients

**Status:** ⏳ pending

**Fecha primera asunción:** 2026-05-31

**Response:**

```typescript
Client[]

interface Client {
  id: string;
  name: string;                    // min(1).max(120) en frontend
  email: string | null;            // valid email format si no es null
  company: string | null;          // max(120) en frontend
  phone: string | null;            // max(40) en frontend
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;               // ISO datetime
  _count: { quotes: number };      // int().nonnegative()
}
```

**Archivos que usan este shape:**

- `apps/dashboard/src/features/clients/schemas/client-schema.ts` (`clientSchema` + `Client` type, líneas 3–16)
- `apps/dashboard/src/features/clients/api/clients-api.ts` (`fetchClients`, líneas 219–222)
- `apps/dashboard/src/features/clients/hooks/use-clients.ts` (`useClients` + `clientsQueryOptions`, líneas 5–12)

**Notas / preguntas para backend:**

- ¿Existe el campo `createdAt` en la respuesta? Si no, hay que removerlo del schema y deshabilitar el sort por fecha (no aplicado hoy pero queda preparado).
- ¿Devuelve siempre TODOS los clientes o ya viene paginado server-side? Si paginado, ¿qué query params? (`?page=`, `?limit=`, `?cursor=`)
- ¿Devuelve los clientes `INACTIVE` por default, o hay un query param `?status=`?

**Notas de búsqueda (client-side actual):**

- Search matchea SOLO `name`, `email`, `company`. **`phone` está excluido** (decisión de UX: los teléfonos tienen formatos inconsistentes y los usuarios no buscan por número).
- Cuando el backend implemente server-side search, mantener esa exclusión (o documentar el cambio).
- Normalize aplica NFD + strip diacríticos + lowercase, ver `apps/dashboard/src/features/clients/lib/search-clients.ts` (líneas 3–8).

**Trazabilidad:** Introducido en HU-FE-005 (CRUD completo de clientes), commit `985ad35`.

---

### [POST] /clients

**Status:** ⏳ pending

**Fecha primera asunción:** 2026-05-31

**Request payload:**

```typescript
interface ClientCreatePayload {
  name: string;       // required, max 120
  email: string;      // valid email OR empty string
  company: string;    // max 120, empty allowed
  phone: string;      // max 40, empty allowed
}
```

**Response:** `Client` (mismo shape que GET).

**Archivos que usan este shape:**

- `apps/dashboard/src/features/clients/schemas/client-schema.ts` (`clientCreateSchema` + `ClientCreateInput` type, líneas 18–35)
- `apps/dashboard/src/features/clients/api/clients-api.ts` (`ClientCreatePayload` interface líneas 3–10, `createClient` función líneas 233–247)
- `apps/dashboard/src/features/clients/hooks/use-create-client.ts` (`useCreateClient`, líneas 7–21)
- `apps/dashboard/src/features/clients/components/client-form-dialog.tsx` (form que usa `clientCreateSchema`)

**Notas / preguntas para backend:**

- ¿El campo `email` acepta string vacío como "sin email"? Frontend manda `""` cuando el user no llena el campo.
- ¿El campo `company` y `phone` aceptan string vacío como "sin valor"? Mismo caso.
- ¿El backend genera el `id` (UUID típicamente) o el frontend debería mandarlo?
- ¿El `status` default es `"ACTIVE"`? Frontend asume que sí.
- ¿El `_count.quotes` siempre arranca en 0?
- ¿El `createdAt` lo setea el backend en `new Date().toISOString()`?

**Trazabilidad:** Introducido en HU-FE-005, commit `985ad35`.

---

### [PATCH] /clients/:id

**Status:** ⏳ pending

**Fecha primera asunción:** 2026-05-31

**Request payload:**

```typescript
type ClientUpdatePayload = Partial<ClientCreatePayload>

// Semantically partial: only fields the user changed need to be sent.
// In practice the frontend sends all 4 fields (RHF defaultValues are strings, not undefined).
// The form validates with clientCreateSchema (not partial) to prevent saving nameless clients.
```

**Response:** `Client` (mismo shape que GET).

**Archivos que usan este shape:**

- `apps/dashboard/src/features/clients/schemas/client-schema.ts` (`clientUpdateSchema` + `ClientUpdateInput` type, líneas 37–43)
- `apps/dashboard/src/features/clients/api/clients-api.ts` (`ClientUpdatePayload` type líneas 12–14, `updateClient` función líneas 249–268)
- `apps/dashboard/src/features/clients/hooks/use-update-client.ts` (`useUpdateClient`, líneas 14–28)
- `apps/dashboard/src/features/clients/components/client-form-dialog.tsx` (form en modo edit)

**Notas / preguntas para backend:**

- ¿Es PATCH semántico (campos no enviados se mantienen) o PUT semántico (reemplazo completo)? El frontend funciona con ambos, pero queremos saber.
- ¿Devuelve el cliente completo actualizado o solo los campos cambiados? Frontend espera el cliente completo (para reemplazar en cache).
- ¿Qué pasa si `id` no existe? Frontend espera `404 Not Found`.

**Trazabilidad:** Introducido en HU-FE-005, commit `912402c`.

---

### [DELETE] /clients/:id

**Status:** ⏳ pending

**Fecha primera asunción:** 2026-05-31

**Response:** `204 No Content` (sin body).

**Archivos que usan este shape:**

- `apps/dashboard/src/features/clients/api/clients-api.ts` (`deleteClient`, líneas 270–277)
- `apps/dashboard/src/features/clients/hooks/use-delete-client.ts` (`useDeleteClient`, líneas 7–21)
- `apps/dashboard/src/features/clients/components/client-delete-dialog.tsx` (dialog de confirmación)

**Notas / preguntas para backend:**

- ¿Es idempotente (delete de id inexistente devuelve 204) o devuelve 404? Frontend implementa el mock con error en id inexistente. Si backend es idempotente, podemos relajar el frontend.
- ¿Hay soft-delete (status flag) o hard-delete?
- ¿Qué pasa si el cliente tiene quotes asociadas (`_count.quotes > 0`)? ¿El backend bloquea con 409 Conflict, o las quotes huérfanas se eliminan en cascade?

**Trazabilidad:** Introducido en HU-FE-005, commit `985ad35`.

---

## Endpoints relacionados (referencia futura)

Estos endpoints pueden aparecer en HUs futuras y comparten el shape `Client`:

- `GET /clients/:id` — para mostrar detalles individuales (no implementado en HU-FE-005 porque la HU pide CRUD de lista, no de detalle). El frontend ya tiene `fetchClientById` mockeado en `apps/dashboard/src/features/clients/api/clients-api.ts` (líneas 224–231), preparado para cuando se conecte.
- `GET /clients/:id/quotes` — listado de cotizaciones de un cliente. Relacionado con `Client._count.quotes`.
