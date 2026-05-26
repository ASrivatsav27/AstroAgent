import type { AgentState } from "../state.js";


export async function routerNode(state: AgentState): Promise<Partial<AgentState>> {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) {
        return {intent : "free_form"}
    }
  const text = lastMessage.content.toLowerCase();

  // Simple keyword-based intent classification
  if (
    text.includes("birth chart") ||
    text.includes("natal") ||
    text.includes("moon sign") ||
    text.includes("rising") ||
    text.includes("ascendant") ||
    text.includes("planets")
  ) {
    return { intent: "chart_request" };
  }

  if (
    text.includes("today") ||
    text.includes("energy") ||
    text.includes("transit") ||
    text.includes("retrograde") ||
    text.includes("current")
  ) {
    return { intent: "daily_transit" };
  }

  if (
    text.includes("stock") ||
    text.includes("invest") ||
    text.includes("medicine") ||
    text.includes("diagnosis") ||
    text.includes("ignore previous")
  ) {
    return { intent: "off_topic" };
  }

  return { intent: "free_form" };
}