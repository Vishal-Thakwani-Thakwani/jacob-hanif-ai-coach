const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

export interface OuraData {
  readiness_score?: number;
  sleep_score?: number;
  activity_score?: number;
  hrv_balance?: number;
  steps?: number;
  active_calories?: number;
  sleep_efficiency?: number;
}

export interface TrainingLog {
  exercise: string;
  metric_type: string;
  metric_value: number;
  sets?: number;
  notes?: string;
  date?: string;
}

export interface ProgressSummary {
  oura: {
    weekly_avg: Record<string, number | null>;
    biweekly_avg: Record<string, number | null>;
    readiness_trend: { trend: string; change_percent: number | null };
    sleep_trend: { trend: string; change_percent: number | null };
  };
  training: Record<string, {
    exercise: string;
    metric: string;
    trend: string;
    change_percent: number;
    recent_avg: number;
    previous_avg: number;
  }>;
  analysis: {
    flags: string[];
  };
}

/**
 * Stream chat response from backend using SSE
 */
export async function* streamMessage(
  message: string,
  accessToken: string,
  conversationId?: string,
  imageB64?: string,
  imageType?: string
): AsyncGenerator<string, void, unknown> {
  const backendUrl = BACKEND_URL;
  console.log("streamMessage called");
  console.log("  Backend URL:", backendUrl);
  console.log("  Has access token:", !!accessToken);
  console.log("  Token preview:", accessToken ? accessToken.substring(0, 20) + "..." : "none");
  
  let response: Response;
  try {
    const requestBody = {
      message,
      conversation_id: conversationId,
      image_b64: imageB64,
      image_type: imageType,
    };
    console.log("  Request body:", { ...requestBody, image_b64: imageB64 ? "[base64 data]" : undefined });
    
    response = await fetch(`${backendUrl}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchError) {
    console.error("Fetch failed:", fetchError);
    console.error("  Error type:", fetchError instanceof TypeError ? "TypeError (likely CORS or network)" : typeof fetchError);
    throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Failed to connect to server'}`);
  }

  console.log("Response received, status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("API error:", response.status, errorText);
    throw new Error(`Chat failed: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        
        try {
          const parsed = JSON.parse(data);
          if (parsed.token) {
            yield parsed.token;
          } else if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  }
}

/**
 * Non-streaming fallback for simpler use cases
 */
export async function sendMessage(
  message: string,
  imageB64?: string,
  imageType?: string,
  ouraData?: OuraData
): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      image_b64: imageB64,
      image_type: imageType,
      oura_data: ouraData,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  const data = await response.json();
  return data.answer;
}

export async function syncOura(accessToken: string): Promise<OuraData> {
  const response = await fetch(`${BACKEND_URL}/integrations/oura/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync Oura: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

export async function syncOuraHistory(accessToken: string): Promise<{
  history: Record<string, unknown[]>;
  averages: Record<string, number | string | null>;
}> {
  const response = await fetch(`${BACKEND_URL}/integrations/oura/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync Oura history: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

export async function logTraining(log: TrainingLog): Promise<{ log_id: number }> {
  const response = await fetch(`${BACKEND_URL}/integrations/training/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(log),
  });

  if (!response.ok) {
    throw new Error(`Failed to log training: ${response.statusText}`);
  }

  return response.json();
}

export async function getProgressSummary(): Promise<ProgressSummary> {
  const response = await fetch(`${BACKEND_URL}/integrations/progress/summary`);

  if (!response.ok) {
    throw new Error(`Failed to get progress: ${response.statusText}`);
  }

  const data = await response.json();
  return data.summary;
}
