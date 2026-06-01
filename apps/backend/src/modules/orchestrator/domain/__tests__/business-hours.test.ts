import { describe, expect, it } from "bun:test";

import { isWithinBusinessHours } from "../business-hours";

// All instants are expressed in UTC. Colombia (America/Bogota) is UTC-5 with no
// DST, so Bogota local time = UTC - 5h. Each case notes the resulting Bogota
// wall-clock to make the intent explicit.
describe("isWithinBusinessHours", () => {
  describe("weekdays (Mon-Fri 07:30-16:30 Bogota)", () => {
    it("is open mid-morning on a Monday", () => {
      // UTC Mon 15:00 -> Bogota Mon 10:00
      expect(isWithinBusinessHours(new Date("2026-06-01T15:00:00Z"))).toBe(true);
    });

    it("is open exactly at 07:30 (inclusive)", () => {
      // UTC Mon 12:30 -> Bogota Mon 07:30
      expect(isWithinBusinessHours(new Date("2026-06-01T12:30:00Z"))).toBe(true);
    });

    it("is closed one minute before opening", () => {
      // UTC Mon 12:29 -> Bogota Mon 07:29
      expect(isWithinBusinessHours(new Date("2026-06-01T12:29:00Z"))).toBe(false);
    });

    it("is closed exactly at 16:30 (exclusive)", () => {
      // UTC Mon 21:30 -> Bogota Mon 16:30
      expect(isWithinBusinessHours(new Date("2026-06-01T21:30:00Z"))).toBe(false);
    });

    it("is open one minute before closing", () => {
      // UTC Mon 21:29 -> Bogota Mon 16:29
      expect(isWithinBusinessHours(new Date("2026-06-01T21:29:00Z"))).toBe(true);
    });
  });

  describe("Saturdays (08:00-12:00 Bogota)", () => {
    it("is open mid-morning on a Saturday", () => {
      // UTC Sat 15:00 -> Bogota Sat 10:00
      expect(isWithinBusinessHours(new Date("2026-06-06T15:00:00Z"))).toBe(true);
    });

    it("is open exactly at 08:00 (inclusive)", () => {
      // UTC Sat 13:00 -> Bogota Sat 08:00
      expect(isWithinBusinessHours(new Date("2026-06-06T13:00:00Z"))).toBe(true);
    });

    it("is closed exactly at 12:00 (exclusive)", () => {
      // UTC Sat 17:00 -> Bogota Sat 12:00
      expect(isWithinBusinessHours(new Date("2026-06-06T17:00:00Z"))).toBe(false);
    });
  });

  describe("Sundays (always closed)", () => {
    it("is closed mid-morning on a Sunday", () => {
      // UTC Sun 15:00 -> Bogota Sun 10:00
      expect(isWithinBusinessHours(new Date("2026-06-07T15:00:00Z"))).toBe(false);
    });
  });

  describe("timezone correctness", () => {
    it("uses Bogota time, not the raw UTC hour", () => {
      // UTC Mon 11:00 would be "open" if read naively (within 07:30-16:30),
      // but Bogota is Mon 06:00 -> still closed.
      expect(isWithinBusinessHours(new Date("2026-06-01T11:00:00Z"))).toBe(false);
    });
  });
});
