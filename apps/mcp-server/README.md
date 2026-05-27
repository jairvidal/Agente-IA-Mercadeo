# MCP Server — Capability Layer

Expone tools, resources y prompts al Orchestrator via el protocolo MCP.

## Desarrollo

```bash
cd apps/mcp-server
bun install
bun dev          # hot-reload en :8000
```

## Endpoints

| Endpoint | Descripción |
|---|---|
| `GET /health` | Health check |
| `POST /mcp` | Protocolo MCP (Streamable HTTP) |

## Agregar un tool

```bash
# Desde la raíz del proyecto:
./scripts/add-tool.sh nombre-del-tool
```

Luego regístralo en `src/register-tools.ts`:

```ts
import { registerNombreDelToolTool } from "./tools/nombre-del-tool.ts";

export const registerTools = (server: McpServer) => {
  registerNombreDelToolTool(server);
};
```

## Agregar un resource

Crea `src/resources/mi-resource.ts` siguiendo el patrón de `_template-resource.ts`, luego regístralo en `src/register-resources.ts`.

## Agregar un prompt

Crea `src/prompts/mi-prompt.ts` siguiendo el patrón de `_template-prompt.ts`, luego regístralo en `src/register-prompts.ts`.

## Tests

```bash
bun test
```
