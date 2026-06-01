import { BUSINESS_HOURS, BUSINESS_TIMEZONE, type DailyHours, type Weekday } from "./constants";

/** Converts an "HH:MM" string into minutes since midnight. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
}

/**
 * Resolves the weekday and minute-of-day for `now` in `BUSINESS_TIMEZONE`,
 * independent of the host machine's timezone.
 */
function partsInBusinessTimezone(now: Date): {
  weekday: Weekday;
  minutesOfDay: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday") as Weekday;
  const minutesOfDay = Number(get("hour")) * 60 + Number(get("minute"));
  return { weekday, minutesOfDay };
}

/**
 * Whether `now` falls within Sidoc's service hours (see `BUSINESS_HOURS`).
 *
 * Open is inclusive, close is exclusive: at exactly the closing time the bot is
 * already considered off-hours. Sundays (and any day mapped to `null`) are
 * always closed.
 */
export function isWithinBusinessHours(now: Date): boolean {
  const { weekday, minutesOfDay } = partsInBusinessTimezone(now);
  const today: DailyHours | null = BUSINESS_HOURS[weekday];
  if (!today) return false;
  return minutesOfDay >= toMinutes(today.open) && minutesOfDay < toMinutes(today.close);
}
