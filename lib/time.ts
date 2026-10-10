/**
 * Brazilian tax and exchange-rate dates follow Brasília time, not UTC: a
 * payment at 22:30 in São Paulo is already "tomorrow" in UTC. Everything that
 * turns an instant into a calendar date goes through here.
 */
const BRT = "America/Sao_Paulo";

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: BRT,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: BRT,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Calendar date in Brasília time, as YYYY-MM-DD. */
export function brtDate(instant: Date): string {
  return dateFormat.format(instant);
}

/** "2026-10-07 11:03", in Brasília time. */
export function brtDateTime(instant: Date): string {
  return `${dateFormat.format(instant)} ${timeFormat.format(instant)}`;
}

/** Shifts a YYYY-MM-DD date by whole days. */
export function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for a YYYY-MM-DD date. */
export function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** ISO instant without milliseconds: "2026-10-07T14:03:11Z". */
export function isoSeconds(instant: Date): string {
  return instant.toISOString().replace(/\.\d{3}Z$/, "Z");
}
