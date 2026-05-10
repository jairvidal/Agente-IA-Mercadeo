# SIDOC Dashboard

Backoffice SPA del Agente IA Mercadeo (CRM interno SIDOC).

Stack: **Vite 5 · React 19 · TypeScript · TanStack Router · TanStack Query · TailwindCSS · Radix UI**

Decisión arquitectónica en [`ADR-004`](../../../docs/Agente-IA-Mercadeo/docs/architecture/adr-004-dashboard-spa.md).

## Inicio

```bash
bun install
cp .env.example .env
bun run dev
```

Abre http://localhost:5173.

## Scripts

| Script         | Qué hace                                             |
| -------------- | ---------------------------------------------------- |
| `bun run dev`     | Servidor de desarrollo con HMR                    |
| `bun run build`   | Type-check + bundle estático en `dist/`           |
| `bun run preview` | Sirve `dist/` localmente para validar el build    |
| `bun run type-check` | Solo type-check                                |

## Estructura

```
src/
├── routes/                  TanStack Router file-based routes
│   ├── __root.tsx           Root layout (providers, devtools)
│   ├── index.tsx            Redirect → /dashboard
│   ├── _auth.tsx            Auth shell (login)
│   ├── _auth.login.tsx
│   ├── _dashboard.tsx       Dashboard shell + auth guard
│   ├── _dashboard.dashboard.tsx
│   ├── _dashboard.leads.tsx
│   ├── _dashboard.quotes.tsx
│   ├── _dashboard.clients.tsx
│   └── _dashboard.profile.tsx
├── components/
│   ├── ui/                  Primitivos (button, input, dialog, toast, ...)
│   ├── layout/              Sidebar, header, theme toggle
│   ├── kanban/              Board reutilizable con @hello-pangea/dnd
│   └── auth/                Token refresher
├── features/
│   └── leads/               Kanban de leads (board + handlers)
├── hooks/
├── lib/                     utils, env, api client
├── providers/
└── styles/globals.css
```

## API y auth

El dashboard consume el backend (`apps/backend/`, Elysia) en `VITE_API_URL`. No tiene runtime Node — todo el bundle es estático y se sirve desde S3 + CloudFront.

- **Auth** vía cookie httpOnly emitida por el backend (plugin `auth`). El SPA hace requests con `credentials: "include"`.
- **`useSession()`** hoy retorna un usuario stub (`dev@sidoc.co`) hasta que el backend exponga `GET /auth/session`. Ver `src/hooks/use-session.ts`.
- **`apiClient`** en `src/lib/api.ts` es un wrapper minimal de `fetch`. Cuando `packages/shared` exporte tipos del backend, se intercambia por **Eden** (cliente type-safe de Elysia).

## Variables de entorno

Solo variables con prefijo `VITE_` llegan al bundle (público). **Nunca** poner secrets aquí — todo lo sensible vive en el backend.

Ver [`.env.example`](./.env.example).

## Routing

TanStack Router file-based. El plugin de Vite genera `src/routeTree.gen.ts` automáticamente al correr `dev`/`build`. Está en `.gitignore`.

Layouts pathless con prefijo `_`:
- `_auth` envuelve rutas no autenticadas (login)
- `_dashboard` envuelve rutas autenticadas e incluye el guard que redirige a `/login` si no hay sesión
