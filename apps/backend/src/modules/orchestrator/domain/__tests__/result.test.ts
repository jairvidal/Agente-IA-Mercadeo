import { describe, expect, it } from "bun:test";

import {
	err,
	flatMap,
	isErr,
	isOk,
	map,
	mapErr,
	ok,
	type Result,
} from "@/modules/orchestrator/domain/result";

describe("Result", () => {
	describe("constructors", () => {
		it("ok(v) produces { ok: true, value: v }", () => {
			const r = ok(42);
			expect(r).toEqual({ ok: true, value: 42 });
		});

		it("err(e) produces { ok: false, error: e }", () => {
			const e = new Error("boom");
			const r = err(e);
			expect(r).toEqual({ ok: false, error: e });
		});
	});

	describe("type guards", () => {
		it("isOk narrows to the Ok variant", () => {
			const r: Result<number, string> = ok(7);
			if (isOk(r)) {
				// Type narrowing: r.value is number, no need for `as` or `!`.
				const v: number = r.value;
				expect(v).toBe(7);
				// @ts-expect-error - error does not exist on Ok
				r.error;
			} else {
				throw new Error("expected Ok");
			}
		});

		it("isErr narrows to the Err variant", () => {
			const r: Result<number, string> = err("nope");
			if (isErr(r)) {
				const e: string = r.error;
				expect(e).toBe("nope");
				// @ts-expect-error - value does not exist on Err
				r.value;
			} else {
				throw new Error("expected Err");
			}
		});
	});

	describe("map", () => {
		it("transforms the value when Ok", () => {
			const r = map(ok(3), (n) => n * 2);
			expect(r).toEqual({ ok: true, value: 6 });
		});

		it("leaves Err untouched", () => {
			const original: Result<number, string> = err("e");
			const r = map(original, (n) => n * 2);
			expect(r).toEqual({ ok: false, error: "e" });
		});
	});

	describe("flatMap", () => {
		it("chains when Ok", () => {
			const r = flatMap(ok(3), (n) => ok(n + 1));
			expect(r).toEqual({ ok: true, value: 4 });
		});

		it("short-circuits on Err", () => {
			const original: Result<number, string> = err("first");
			const r = flatMap(original, (n) => ok(n + 1));
			expect(r).toEqual({ ok: false, error: "first" });
		});

		it("propagates the inner Err", () => {
			const r = flatMap<number, number, string>(ok(3), () => err("inner"));
			expect(r).toEqual({ ok: false, error: "inner" });
		});
	});

	describe("mapErr", () => {
		it("transforms the error when Err", () => {
			const r = mapErr(err("low"), (e) => `wrapped:${e}`);
			expect(r).toEqual({ ok: false, error: "wrapped:low" });
		});

		it("leaves Ok untouched", () => {
			const original: Result<number, string> = ok(1);
			const r = mapErr(original, (e) => `wrapped:${e}`);
			expect(r).toEqual({ ok: true, value: 1 });
		});
	});
});
