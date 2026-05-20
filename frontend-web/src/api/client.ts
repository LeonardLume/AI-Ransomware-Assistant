import type {
  AnswerSubmitResponse,
  ChatRequestOptions,
  ChatResponse,
  DemoProfileResponse,
  HealthResponse,
  ProviderStatusResponse,
  Question,
  ReportResponse,
  ScoreResponse,
  SessionCreateResponse,
  SessionStateResponse,
  TechnicalFlowResponse,
} from "../types/api";

const DEFAULT_API_PORT = (import.meta.env.VITE_API_PORT as string | undefined) || "8000";
const DEFAULT_API_BASE_URL = import.meta.env.PROD ? "/api" : "";
const API_AUTH_TOKEN = (import.meta.env.VITE_API_AUTH_TOKEN as string | undefined)?.trim() || "";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

function resolveApiBaseUrl(): string {
  const fallbackBaseUrl =
    DEFAULT_API_BASE_URL ||
    (typeof window === "undefined"
      ? `http://127.0.0.1:${DEFAULT_API_PORT}`
      : `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname || "127.0.0.1"}:${DEFAULT_API_PORT}`);

  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, "");
  if (!configuredBaseUrl) {
    return fallbackBaseUrl;
  }

  if (typeof window === "undefined" || isLoopbackHost(window.location.hostname)) {
    return configuredBaseUrl;
  }

  try {
    const url = new URL(configuredBaseUrl);
    if (isLoopbackHost(url.hostname)) {
      url.hostname = window.location.hostname;
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    return configuredBaseUrl;
  }

  return configuredBaseUrl;
}

const API_BASE_URL = resolveApiBaseUrl();
const DEFAULT_TIMEOUT_MS = 25_000;

function buildHeaders(headers?: HeadersInit): Headers {
  const next = new Headers(headers);
  if (!next.has("Content-Type")) {
    next.set("Content-Type", "application/json");
  }
  if (API_AUTH_TOKEN && !next.has("Authorization") && !next.has("X-API-Key")) {
    next.set("Authorization", `Bearer ${API_AUTH_TOKEN}`);
  }
  return next;
}

export class ApiError extends Error {
  status?: number;
  payload?: unknown;

  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: buildHeaders(options.headers),
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const detail =
        typeof payload === "object" && payload && "detail" in payload
          ? String((payload as { detail?: unknown }).detail)
          : response.statusText;
      throw new ApiError(
        `Backend request failed (${response.status}): ${detail}`,
        response.status,
        payload,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(`Backend request timed out after ${timeoutMs / 1000}s`);
    }
    throw new ApiError(
      error instanceof Error
        ? `Backend request failed: ${error.message}`
        : "Backend request failed",
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function healthCheck(): Promise<HealthResponse> {
  return request<HealthResponse>("/");
}

export function createSession(
  orgInfo: Record<string, unknown> = {},
): Promise<SessionCreateResponse> {
  return request<SessionCreateResponse>("/session", {
    method: "POST",
    body: JSON.stringify(orgInfo),
  });
}

export function getQuestions(): Promise<Question[]> {
  return request<Question[]>("/questions");
}

export function chat(
  sessionId: string | null,
  message: string,
  options: ChatRequestOptions = {},
): Promise<ChatResponse> {
  return request<ChatResponse>(
    "/chat",
    {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        message,
        intent_mode: options.intent_mode,
        selected_answer: options.selected_answer,
      }),
    },
    60_000,
  );
}

export function getSession(sessionId: string): Promise<SessionStateResponse> {
  return request<SessionStateResponse>(`/session/${encodeURIComponent(sessionId)}`);
}

export function getScore(sessionId: string): Promise<ScoreResponse> {
  return request<ScoreResponse>(`/score/${encodeURIComponent(sessionId)}`);
}

export function getReport(sessionId: string): Promise<ReportResponse> {
  return request<ReportResponse>(
    `/report/${encodeURIComponent(sessionId)}`,
    {},
    60_000,
  );
}

export function submitAnswer(
  sessionId: string,
  questionId: string,
  answer: string,
  details = "",
): Promise<AnswerSubmitResponse> {
  return request<AnswerSubmitResponse>("/answer", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      answer,
      details,
    }),
  });
}

export async function getProviderStatus(): Promise<ProviderStatusResponse> {
  try {
    return await request<ProviderStatusResponse>("/provider/status");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return request<ProviderStatusResponse>("/llm/status");
    }
    throw error;
  }
}

export function getTechnicalFlow(): Promise<TechnicalFlowResponse> {
  return request<TechnicalFlowResponse>("/technical/flow");
}

export function loadDemoProfile(profileId: string): Promise<DemoProfileResponse> {
  return request<DemoProfileResponse>("/demo/load-profile", {
    method: "POST",
    body: JSON.stringify({ profile_id: profileId }),
  });
}
