import { cleanPoints, isAddress } from "./model";
import type { NavPoint } from "./types";
const PIN_KEY = "bookdesk.pin.v1";
const HISTORY = "bookdesk.history.v1.";
export function savedPin() {
  try {
    const a = localStorage.getItem(PIN_KEY);
    return a && isAddress(a) ? a.toLowerCase() : "";
  } catch {
    return "";
  }
}
export function savePin(token: string): boolean {
  try {
    if (token) localStorage.setItem(PIN_KEY, token.toLowerCase());
    else localStorage.removeItem(PIN_KEY);
    return true;
  } catch {
    return false;
  }
}
export function loadHistory(token: string): NavPoint[] {
  try {
    return cleanPoints(
      JSON.parse(localStorage.getItem(HISTORY + token.toLowerCase()) ?? "[]"),
    );
  } catch {
    return [];
  }
}
export function recordPoint(
  token: string,
  point: NavPoint,
): { points: NavPoint[]; saved: boolean } {
  const points = loadHistory(token);
  const last = points.at(-1);
  if (last && point.t < last.t) return { points, saved: true };
  // One point per minute, bounded to 1,440 samples per Book.
  if (last && Math.floor(last.t / 60) === Math.floor(point.t / 60))
    points[points.length - 1] = point;
  else points.push(point);
  const bounded = points.slice(-1440);
  try {
    localStorage.setItem(
      HISTORY + token.toLowerCase(),
      JSON.stringify(bounded),
    );
    return { points: bounded, saved: true };
  } catch {
    return { points: bounded, saved: false };
  }
}
