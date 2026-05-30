import { describe, expect, it } from "bun:test";

import {
	buildRetryStrategy,
	MAX_CONNECT_RETRIES,
	redactRedisUrl,
} from "../ioredis.adapter";

describe("buildRetryStrategy", () => {
	it("returns a bounded backoff for attempts <= MAX_CONNECT_RETRIES", () => {
		const strategy = buildRetryStrategy();
		expect(strategy(1)).toBe(200);
		expect(strategy(5)).toBe(1000);
		// caps at 2000ms regardless of attempt number within budget
		expect(strategy(MAX_CONNECT_RETRIES)).toBe(2000);
	});

	it("returns null after exceeding the retry budget so ioredis stops looping", () => {
		const strategy = buildRetryStrategy(3);
		expect(strategy(3)).toBeNumber();
		expect(strategy(4)).toBeNull();
		expect(strategy(99)).toBeNull();
	});
});

describe("redactRedisUrl", () => {
	it("strips password from a standard redis:// URL", () => {
		expect(redactRedisUrl("redis://user:s3cret@host:6379/0")).toBe(
			"redis://host:6379/0",
		);
	});

	it("leaves URLs without userinfo unchanged", () => {
		expect(redactRedisUrl("redis://localhost:6379")).toBe(
			"redis://localhost:6379",
		);
	});

	it("falls back to a regex replacement for unparsable inputs", () => {
		// Missing scheme so `new URL` throws; regex fallback handles it.
		expect(redactRedisUrl("//user:pass@host:6379")).toContain("//***@");
	});
});
