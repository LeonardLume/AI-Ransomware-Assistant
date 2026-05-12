import type { SessionSummary } from "../types/api";

const STORAGE_KEY = "ransomware-readiness.sessions";

function isSessionSummary(value: unknown): value is SessionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<SessionSummary>;
  return Boolean(candidate.id && candidate.title && candidate.createdAt && candidate.updatedAt);
}

export function getSessions(): SessionSummary[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isSessionSummary).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  } catch {
    return [];
  }
}

export function saveSessions(sessions: SessionSummary[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function upsertSession(summary: SessionSummary): SessionSummary[] {
  const existing = getSessions();
  const withoutCurrent = existing.filter((item) => item.id !== summary.id);
  const next = [summary, ...withoutCurrent].slice(0, 25);
  saveSessions(next);
  return next;
}

export function updateSession(
  id: string,
  patch: Partial<Omit<SessionSummary, "id" | "createdAt">>,
): SessionSummary[] {
  const existing = getSessions();
  const next = existing.map((item) =>
    item.id === id
      ? {
          ...item,
          ...patch,
          updatedAt: patch.updatedAt || new Date().toISOString(),
        }
      : item,
  );
  saveSessions(next);
  return next;
}

export function removeSession(id: string): SessionSummary[] {
  const next = getSessions().filter((item) => item.id !== id);
  saveSessions(next);
  return next;
}

export function makeSessionSummary(
  id: string,
  patch: Partial<SessionSummary> = {},
): SessionSummary {
  const now = new Date().toISOString();
  return {
    id,
    title: patch.title || `Assessment ${id.slice(0, 8)}`,
    createdAt: patch.createdAt || now,
    updatedAt: patch.updatedAt || now,
    profileName: patch.profileName,
    completionRate: patch.completionRate,
    riskLevel: patch.riskLevel,
  };
}
