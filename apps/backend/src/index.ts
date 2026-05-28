import { app } from "./app";

console.log(
	`🦊 ${app.config.name} is running at ${app.server?.hostname}:${app.server?.port}`,
);
