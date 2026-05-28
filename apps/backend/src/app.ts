import cors from "@elysiajs/cors";
import { logger } from "@sidoc/observability";
import { Elysia } from "elysia";

import { buildOrchestratorModule } from "@/modules/orchestrator/infrastructure/container";

const PORT = process.env.BACKEND_PORT;
const PROJECT_NAME = process.env.PROJECT_NAME;

const orchestrator = buildOrchestratorModule();

const app = new Elysia({ name: PROJECT_NAME })
	.onError(({ code, error, path, set }) => {
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error({ code, err, path }, "Unhandled request error");
		set.status = code === "NOT_FOUND" ? 404 : 500;
		return { error: err.message };
	})
	.use(cors())
	.use(orchestrator.routes)
	.get("/", () => "Hello Elysia")
	.listen({
		port: Number(PORT),
	});

export { app };
