/**
 * Chat API Service
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface AttachmentFile {
  filename: string;
  content: string;
  file_type: string;
}

export interface SourceDocument {
  content: string;
  filename: string;
  page_number?: number;
  relevance_score?: number;
}

export interface ChatRequest {
  query: string;
  history?: ChatMessage[];
  attachments?: AttachmentFile[];
  include_sources?: boolean;
  model_preference?: "flash" | "thinking";
}

export interface ChatResponse {
  answer: string;
  sources: SourceDocument[];
  timestamp: string;
}

export interface ChatError {
  detail: string;
  status: number;
}

/**
 * Send a chat message to the AI agent
 */
export async function sendChatMessage(
  request: ChatRequest,
  authToken: string,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      query: request.query,
      history: request.history || [],
      attachments: request.attachments || [],
      include_sources: request.include_sources ?? true,
      model_preference: request.model_preference || "flash",
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Upload a document to the backend
 */
export async function uploadDocument(
  file: File,
  authToken: string
): Promise<{ id: string; filename: string; message: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/documents/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * List uploaded documents
 */
export async function listDocuments(
  authToken: string
): Promise<{ documents: Array<{ id: string; filename: string; created_at: string }> }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/documents/list`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to list documents" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Check chat service health
 */
export async function checkChatHealth(): Promise<{ status: string; service: string; timestamp: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/health`);
  
  if (!response.ok) {
    throw new Error("Chat service unavailable");
  }

  return response.json();
}

/**
 * Extract text from a file for session-only attachment
 * Uses backend /extract-text endpoint for PDF/DOCX, FileReader for txt files
 */
export async function extractFileText(
  file: File,
  authToken: string
): Promise<AttachmentFile> {
  const filename = file.name.toLowerCase();

  // For PDF and DOCX files, use the backend extraction endpoint
  if (filename.endsWith(".pdf") || filename.endsWith(".doc") || filename.endsWith(".docx")) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/v1/chat/extract-text`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to extract text" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // For text files, read directly in browser
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        filename: file.name,
        content: reader.result as string,
        file_type: "txt",
      });
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}
