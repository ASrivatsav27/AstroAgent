import axios from "axios";
import type { BirthDetails, ChartData, Message } from "../context/AstroContext";

const BASE_URL = "http://localhost:8000/api";

const api = axios.create({ baseURL: BASE_URL });

export async function getUser(userId: string) {
  const response = await api.get<{ birthDetails: BirthDetails | null; chartData: ChartData | null }>(
    `/user/${userId}`
  );
  return response.data;
}

export async function saveBirthDetails(userId: string, birthDetails: BirthDetails) {
  const response = await api.post("/user/birth-details", { userId, birthDetails });
  return response.data;
}

export async function getConversation(userId: string) {
  const response = await api.get<{ messages: Message[] }>(`/conversation/${userId}`);
  return response.data;
}

export async function computeBirthChart(birthDetails: BirthDetails) {
  const response = await api.post<{ chart: ChartData }>("/birth-chart", birthDetails);
  return response.data.chart;
}

export async function sendMessage(
  userId: string,
  message: string,
  birthDetails?: BirthDetails | null,
  signal?: AbortSignal
) {
  const response = await api.post<{
    reply: string;
    intent: string | null;
    messages: Message[];
    chartData: ChartData | null;
  }>(
    "/chat",
    { userId, message, birthDetails },
    { signal }
  );
  return response.data;
}

export type StreamDonePayload = {
  intent: string | null;
  chartData: ChartData | null;
};

/**
 * Streams the assistant reply from /api/chat/stream (SSE).
 * Calls onToken for each text chunk, onToolActivity when a tool runs,
 * and onDone once the stream finishes.
 */
export async function sendMessageStream(
  userId: string,
  message: string,
  birthDetails: BirthDetails | null | undefined,
  onToken: (token: string) => void,
  onToolActivity: (toolName: string) => void,
  onDone: (payload: StreamDonePayload) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, message, birthDetails }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.token !== undefined) {
          onToken(payload.token);
        } else if (payload.tool_activity) {
          onToolActivity(payload.tool_activity);
        } else if (payload.done) {
          onDone({ intent: payload.intent, chartData: payload.chartData });
        } else if (payload.error) {
          throw new Error(payload.error);
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}

