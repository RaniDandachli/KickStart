/** Friday 2pm cash cup — UX constants (server tournament row is configured separately). */

export const FRIDAY_CUP_NAME = 'Friday 8 · $70 Cup';
export const FRIDAY_CUP_ENTRY_USD = 10;
export const FRIDAY_CUP_PRIZE_POOL_USD = 70;
export const FRIDAY_CUP_MAX_PLAYERS = 8;
/** Local hour (0–23) for kickoff messaging — 2pm Friday. */
export const FRIDAY_CUP_START_HOUR_LOCAL = 14;
/** Minutes after a scheduled match start before auto-forfeit (UX copy; enforcement is server-side). */
export const FRIDAY_CUP_FORFEIT_GRACE_MINUTES = 30;

export function nextFridayAtLocalHour(hour: number, from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0 Sun .. 5 Fri
  const targetDow = 5;
  let add = (targetDow - day + 7) % 7;
  if (add === 0 && (d.getHours() > hour || (d.getHours() === hour && d.getMinutes() > 0))) {
    add = 7;
  }
  d.setDate(d.getDate() + add);
  d.setHours(hour, 0, 0, 0);
  return d;
}
