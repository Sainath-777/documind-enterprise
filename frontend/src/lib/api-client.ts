// ============================================================
// DocuMind — Centralized API Client
// All backend calls go through this module.
// ============================================================

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  DocumentListResponse,
  DocumentUploadResponse,
  QueryRequest,
  SSEMetadata,
  SSEToken,
  SSESources,
  SSEDone,
  SSEError,
  SourceChunk,
} from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// Token storage helpers
const TOKEN_KEY = "documind_access_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// Base fetch wrapper with auth headers
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // If 401, the token has expired or was never set — clear auth and redirect to login
    if (res.status === 401 || res.status === 403) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("documind_access_token");
        localStorage.removeItem("documind-auth");
        window.location.href = "/login?expired=true";
      }
      throw new Error("Session expired. Please sign in again.");
    }
    const errorBody = await res.json().catch(() => ({ detail: "Unknown error" }));
    let errorMessage = "An error occurred";

    if (typeof errorBody.detail === "string") {
      errorMessage = errorBody.detail;
    } else if (Array.isArray(errorBody.detail)) {
      // FastAPI validation errors are usually a list of objects: [{ msg, ... }]
      errorMessage = errorBody.detail.map((err: any) => err.msg || JSON.stringify(err)).join(", ");
    } else if (errorBody.detail && typeof errorBody.detail === "object") {
      errorMessage = JSON.stringify(errorBody.detail);
    } else if (errorBody.message) {
      errorMessage = errorBody.message;
    }

    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}

// ============================================================
// AUTH
// ============================================================

export async function loginUser(data: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function registerUser(data: RegisterRequest): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============================================================
// DOCUMENTS
// ============================================================

export async function listDocuments(): Promise<DocumentListResponse> {
  return apiFetch<DocumentListResponse>("/documents");
}

export async function uploadDocument(file: File): Promise<DocumentUploadResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(errorBody.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<DocumentUploadResponse>;
}

export async function deleteDocument(id: string): Promise<void> {
  return apiFetch<void>(`/documents/${id}`, {
    method: "DELETE",
  });
}

// ============================================================
// AUDIT LOGS
// ============================================================

export interface AuditLog {
  id: string;
  timestamp: string;
  event: string;
  query_text: string;
  tokens_used: number | null;
  cost_usd: number;
  retrieval_latency_ms: number | null;
  cache_hit: boolean;
  rerank_applied: boolean;
  chunks_retrieved: number | null;
  status: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
}

export async function getAuditLogs(limit = 50): Promise<AuditLogsResponse> {
  return apiFetch<AuditLogsResponse>(`/audit/logs?limit=${limit}`);
}

// ============================================================
// TEAM
// ============================================================

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  last_login: string | null;
  avatar: string;
  company: string;
  tier: string;
}

export interface TeamResponse {
  members: TeamMember[];
  total: number;
}

export async function getTeamMembers(): Promise<TeamResponse> {
  return apiFetch<TeamResponse>("/audit/team");
}

// ============================================================
// USAGE / QUOTA
// ============================================================

export interface UsageStats {
  tenant_id: string;
  plan_limits: {
    max_queries_per_month: number;
    max_documents: number;
    max_tokens_per_month: number;
  };
  current_usage: {
    queries_this_month: number;
    tokens_this_month: number;
    documents_total: number;
  };
  usage_pct: {
    queries: number;
    tokens: number;
    documents: number;
  };
}

export async function getUsageStats(): Promise<UsageStats> {
  return apiFetch<UsageStats>("/admin/me/usage");
}

// ============================================================
// STREAMING QUERY  (SSE)
// ============================================================

export interface StreamCallbacks {
  onMetadata?: (data: SSEMetadata) => void;
  onToken: (token: string) => void;
  onSources?: (chunks: SourceChunk[]) => void;
  onDone?: (data: SSEDone) => void;
  onError?: (message: string) => void;
}

/**
 * Opens a streaming query against the FastAPI SSE endpoint.
 * Returns an AbortController so the caller can cancel mid-stream.
 */
export function streamQuery(
  request: QueryRequest,
  callbacks: StreamCallbacks
): AbortController {
  const controller = new AbortController();
  const token = getToken();

  // Use native fetch + ReadableStream — works cleanly with Next.js App Router
  (async () => {
    try {
      const res = await fetch(`${API_BASE}/query/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        if (res.status === 401 || res.status === 403) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("documind_access_token");
            localStorage.removeItem("documind-auth");
            window.location.href = "/login?expired=true";
          }
          callbacks.onError?.("Session expired. Please sign in again.");
          return;
        }
        callbacks.onError?.(`HTTP ${res.status}: ${res.statusText}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";  // Keep the incomplete last line

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const rawData = line.slice(6).trim();
            try {
              const parsed = JSON.parse(rawData);
              switch (currentEvent) {
                case "metadata":
                  callbacks.onMetadata?.(parsed as SSEMetadata);
                  break;
                case "token":
                  callbacks.onToken((parsed as SSEToken).content);
                  break;
                case "sources":
                  callbacks.onSources?.((parsed as SSESources).chunks);
                  break;
                case "done":
                  callbacks.onDone?.(parsed as SSEDone);
                  break;
                case "error":
                  callbacks.onError?.((parsed as SSEError).message);
                  break;
              }
            } catch {
              // Malformed JSON — skip silently
            }
            currentEvent = "";
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        callbacks.onError?.((err as Error).message ?? "Stream failed");
      }
    }
  })();

  return controller;
}
