import { logger } from "@sidoc/observability";
import { Redis } from "ioredis";

import type { RedisClient } from "./redis-client.port";

export class IoredisAdapter implements RedisClient {
	constructor(private readonly client: Redis) {}

	async get(key: string): Promise<string | null> {
		return this.client.get(key);
	}

	async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
		await this.client.setex(key, ttlSeconds, value);
	}

	async del(key: string): Promise<void> {
		await this.client.del(key);
	}
}

export const MAX_CONNECT_RETRIES = 10;
const RETRY_BACKOFF_STEP_MS = 200;
const RETRY_BACKOFF_CAP_MS = 2000;

/**
 * Bounded retry budget. Returning `null` tells ioredis to STOP retrying and
 * surface the connection error. Returning a number means "retry in N ms" and
 * would loop forever — that's what we explicitly want to avoid here.
 */
export function buildRetryStrategy(
	maxRetries: number = MAX_CONNECT_RETRIES,
): (times: number) => number | null {
	return (times) => {
		if (times > maxRetries) return null;
		return Math.min(times * RETRY_BACKOFF_STEP_MS, RETRY_BACKOFF_CAP_MS);
	};
}

/**
 * Strips userinfo (`user:password@`) from a Redis URL for safe logging.
 * Falls back to the host portion if the URL is unparsable.
 */
export function redactRedisUrl(url: string): string {
	try {
		const u = new URL(url);
		u.username = "";
		u.password = "";
		return u.toString();
	} catch {
		return url.replace(/\/\/[^@]+@/, "//***@");
	}
}

function extractErrorCode(err: unknown): string | undefined {
	if (err !== null && typeof err === "object" && "code" in err) {
		const code = (err as { code: unknown }).code;
		if (typeof code === "string") return code;
	}
	return undefined;
}

/**
 * Wires a Redis client without connecting (`lazyConnect: true`). The caller is
 * responsible for invoking `pingRedis` at boot to fail fast.
 *
 * The `error` listener is rate-limited: ioredis emits one error per failed
 * reconnect attempt, so we log once per outage episode and reset the flag on
 * the next `ready` event. Without this, dev logs flood with identical stacks.
 */
let singleton: Redis | null = null;

export function getIoredis(url: string): Redis {
	if (singleton) return singleton;

	const client = new Redis(url, {
		lazyConnect: true,
		retryStrategy: buildRetryStrategy(),
		maxRetriesPerRequest: 3,
	});

	// Suppress the very first burst of errors: at boot the container runs
	// `pingRedis` and emits its own accionable log + throw. We only want this
	// listener to catch *runtime* disconnects (after at least one successful
	// `ready`), and even then log once per outage episode.
	let suppressNextError = true;
	client.on("error", (err: unknown) => {
		if (suppressNextError) return;
		suppressNextError = true;
		const code = extractErrorCode(err);
		const message = err instanceof Error ? err.message : String(err);
		logger.error(
			{
				err,
				code,
				redisUrl: redactRedisUrl(url),
			},
			`Redis connection error${code ? ` (${code})` : ""}: ${message}`,
		);
	});
	client.on("ready", () => {
		suppressNextError = false;
	});

	singleton = client;
	return client;
}

/**
 * Forces a real round-trip to Redis. Throws if the server is unreachable so
 * the container can fail fast at boot instead of letting requests fail later.
 */
export async function pingRedis(client: Redis): Promise<void> {
	if (client.status !== "ready") {
		await client.connect();
	}
	await client.ping();
}

/** Test-only: reset the module-level singleton between tests. */
export function __resetIoredisSingletonForTests(): void {
	singleton = null;
}
