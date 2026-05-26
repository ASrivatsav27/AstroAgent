import axios from "axios";
import type { BirthDetails, ChartData, Message } from "../context/AstroContext";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
});

export async function getUser(userId: string) {
  const response = await api.get<{ birthDetails: BirthDetails | null; chartData: ChartData | null }>(
    `/user/${userId}`
  );
  return response.data;
}

export async function saveBirthDetails(userId: string, birthDetails: BirthDetails) {
  const response = await api.post("/user/birth-details", {
    userId,
    birthDetails,
  });
  return response.data;
}

export async function getConversation(userId: string) {
  const response = await api.get<{ messages: Message[] }>(
    `/conversation/${userId}`
  );
  return response.data;
}

export async function sendMessage(userId: string, message: string) {
  const response = await api.post<{
    reply: string;
    intent: string | null;
    messages: Message[];
    chartData: ChartData | null;
  }>(
    "/chat",
    { userId, message }
  );
  return response.data;
}
