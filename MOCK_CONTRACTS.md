# MOCK_CONTRACTS

> Documento de shapes de API asumidos por el frontend antes de que el backend confirme el contrato real. Cada entrada queda pendiente de validación con Yonathan. Cuando el backend correspondiente esté desplegado en staging, validar la entrada y actualizar el campo "Estado".

## Convenciones

- Una sección por endpoint asumido (no por HU, porque varias HU pueden compartir endpoint)
- Estados posibles:
  - ⏳ pendiente — shape asumido, backend aún no desplegado
  - ✅ validado — shape coincide con backend real, no requiere refactor
  - ❌ rechazado — shape real difería del asumido, se refactorizó (dejar nota del refactor en lugar de borrar)
- Si una HU agrega un endpoint que ya existe en este documento, NO duplicar la entrada — actualizar la sección "HUs que lo consumen" de la entrada existente
- Mantener orden alfabético por path del endpoint para facilitar búsqueda

## Plantilla por entrada (copiar y rellenar)

### [METHOD] /path/del/endpoint

- **Estado:** ⏳ pendiente
- **HUs que lo consumen:** HU-FE-XXX, HU-FE-YYY
- **Fecha primera asunción:** YYYY-MM-DD
- **Archivos que lo usan:** apps/dashboard/src/features/XXX/api/yyy.ts (líneas Z-W)

#### Request
```typescript
// shape del request body (si aplica)
interface XxxRequest {
  field: string;
}
```

#### Response
```typescript
// shape del response esperado
interface XxxResponse {
  id: string;
}
```

#### Códigos esperados
- 200: éxito, retorna XxxResponse
- 401: no autenticado, redirigir a /login
- (otros relevantes según el endpoint)

#### Notas y asunciones
- [cualquier asunción no obvia]

---

## Endpoints asumidos

### [GET] /profile

- **Estado:** ⏳ pendiente
- **HUs que lo consumen:** HU-FE-007
- **Fecha primera asunción:** 2026-05-25
- **Archivos que lo usan:** apps/dashboard/src/features/profile/api/profile-api.ts (función `fetchProfile`, líneas ~20-23)

#### Request

Sin body. Autenticación por cookie de sesión (asumido — coherente con el patrón general del backend SIDOC).

#### Response

```typescript
interface ProfileResponse {
  id: string;
  email: string;        // formato email válido
  name: string | null;  // nullable; null = usuario aún no completó su nombre
  createdAt: string;    // ISO 8601 datetime (ej: "2026-01-15T10:00:00.000Z")
}
```

#### Códigos esperados

- **200**: éxito, retorna `ProfileResponse`
- **401**: no autenticado, redirigir a `/login`
- **500**: TBD — confirmar con Yonathan cómo se reporta error de servidor (¿body con `{ message }`? ¿solo status?)

#### Notas y asunciones

- **Trazabilidad del shape:** el shape base de `Profile` ({ id, email, name, createdAt }) ya existía como `interface Profile` inline en `apps/dashboard/src/routes/_dashboard.profile.tsx` en staging antes de esta HU. Lo que esta HU asume/formaliza: validación `.email()` para el campo email, ISO 8601 datetime para createdAt, nullabilidad explícita de `name`, y límite de longitud 1-80 caracteres para `name` (solo aplica a PATCH).
- Mientras HU-FE-002 (login real) esté pausada, el frontend usa `STUB_SESSION` definido en `apps/dashboard/src/features/auth/api/auth-api.ts`. Por coherencia visual, el `mockProfileState` inicial en `profile-api.ts` deriva del mismo stub (`id: "dev"`, `email: "dev@sidoc.co"`, `name: "Dev User"`). Cuando HU-FE-002 se reactive, validar que el `id` del perfil retornado por el backend coincida con el `id` del usuario autenticado.
- Asumimos que `name` es `nullable` para permitir cuentas recién creadas sin nombre. Confirmar con Yonathan si efectivamente puede llegar `null` en producción o si el backend siempre asigna un valor por defecto.

---

### [PATCH] /profile

- **Estado:** ⏳ pendiente
- **HUs que lo consumen:** HU-FE-007
- **Fecha primera asunción:** 2026-05-25
- **Archivos que lo usan:** apps/dashboard/src/features/profile/api/profile-api.ts (función `updateProfile`, líneas ~30-34)

#### Request

```typescript
interface UpdateProfilePayload {
  name: string;
}
```

#### Response

Mismo shape que `GET /profile`. Se retorna el `Profile` completo actualizado (no solo los campos modificados), para que el cliente pueda reemplazar el cache sin merges parciales.

```typescript
interface ProfileResponse {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}
```

#### Códigos esperados

- **200**: éxito, retorna `ProfileResponse` actualizado
- **400**: TBD — reglas de validación pendientes (ver notas)
- **401**: no autenticado, redirigir a `/login`
- **500**: TBD — confirmar formato de error de servidor con Yonathan

#### Notas y asunciones

- **Trazabilidad del shape:** el shape base de `Profile` ({ id, email, name, createdAt }) ya existía como `interface Profile` inline en `apps/dashboard/src/routes/_dashboard.profile.tsx` en staging antes de esta HU. Lo que esta HU asume/formaliza: validación `.email()` para el campo email, ISO 8601 datetime para createdAt, nullabilidad explícita de `name`, y límite de longitud 1-80 caracteres para `name` (solo aplica a PATCH).

Preguntas concretas para Yonathan:

- ¿Permite `name: null` en el payload para "borrar nombre" / volver a estado sin nombre, o `name` es siempre `string` requerido en el PATCH (aunque sea `nullable` en el GET)?
- ¿Hay límite de longitud para `name`? El frontend asume `1-80 caracteres` (mínimo 1 = no acepta string vacío, máximo 80 = se corta visualmente bien en headers). Si el backend impone otro límite, confirmar para alinear validación de Zod en `profileSchema`.
- ¿Qué reglas de validación aplican backend-side? (¿permite emojis? ¿caracteres unicode no-latin? ¿espacios al inicio/final se trimean o se rechazan?) — Necesario para que el form muestre mensajes de error consistentes con lo que el backend rechazará.
- ¿El endpoint es idempotente con respecto a `updatedAt`? (Si se hace el mismo PATCH dos veces, ¿el segundo cambia algún timestamp?) — Relevante para el patrón optimistic con `invalidateQueries` que reconcilia post-mutation.

---
