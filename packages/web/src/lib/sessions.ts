/**
 * localStorage-based session history.
 *
 * XML snippets (sparse line maps around errors) are small enough
 * to store directly in localStorage alongside session metadata.
 */

import type { Session } from "./types";

const STORAGE_KEY = "transmodel-validator-sessions";
const VERSION_KEY = "transmodel-validator-version";
const MAX_SESSIONS = 50;

/**
 * Schema version for stored sessions. Bump this whenever the Session
 * type shape changes to auto-clear incompatible stale data.
 */
const CURRENT_VERSION = 7;

/**
 * Migrate localStorage on first load. If the stored version doesn't
 * match CURRENT_VERSION, all sessions are cleared.
 */
export function migrateIfNeeded(): void {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(VERSION_KEY);
    const storedVersion = stored ? Number(stored) : 0;
    if (storedVersion < CURRENT_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
    }
  } catch {
    // Ignore — localStorage may be unavailable.
  }
}

export function getSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Session[];
  } catch {
    return [];
  }
}

export function getSession(id: string): Session | undefined {
  return getSessions().find((s) => s.id === id);
}

export function saveSession(session: Session): void {
  const sessions = getSessions();
  sessions.unshift(session);
  if (sessions.length > MAX_SESSIONS) {
    sessions.length = MAX_SESSIONS;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function clearSessions(): void {
  localStorage.removeItem(STORAGE_KEY);
}
