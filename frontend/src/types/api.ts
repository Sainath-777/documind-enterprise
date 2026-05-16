// ============================================================
// DocuMind API — TypeScript Type Definitions
// ============================================================

// --- Auth ---
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface RegisterRequest {
  email: string;
  password: string;
  company_name: string;
}

export interface RegisterResponse {
  user_id: string;
  tenant_id: string;
  api_key: string;
  tier: string;
}

// --- Documents ---
export type DocumentStatus = "pending" | "processing" | "indexed" | "failed";

export interface DocumentListItem {
  id: string;
  filename: string;
  processing_status: DocumentStatus;
  file_size_bytes: number;
  upload_date: string;
  chunk_count?: number;
}

export interface DocumentListResponse {
  documents: DocumentListItem[];
  total: number;
}

export interface DocumentUploadResponse {
  job_id: string;
  document_id: string;
  status: string;
  estimated_time: string;
}

// --- Query / Streaming ---
export interface QueryRequest {
  query: string;
  top_k?: number;
}

export interface SourceChunk {
  doc_id: string;
  page: number;
  score: number;
  text_preview: string;
}

// SSE Event shapes
export interface SSEMetadata {
  request_id: string;
  retrieval_latency_ms: number;
  cache_hit: boolean;
}

export interface SSEToken {
  content: string;
}

export interface SSESources {
  chunks: SourceChunk[];
}

export interface SSEDone {
  tokens_used: number;
  cost_usd: number;
  latency_ms: number;
}

export interface SSEError {
  message: string;
}

// --- Chat UI State ---
export interface Citation {
  id: string;
  doc_id: string;
  page: number;
  score: number;
  text_preview: string;
}

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
  metadata?: SSEMetadata;
}
