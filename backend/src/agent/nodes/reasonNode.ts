import type { AgentState } from "../state.js";

export async function reasonNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, birthDetails, toolOutput, messages } = state;

  // Off-topic guard
  if (intent === "off_topic") {
    return {
      messages: [
        ...messages,
        {
          role: "assistant",
          content:
            "I'm only able to help with astrology-related questions — birth charts, transits, and cosmic guidance. What would you like to explore?",
          timestamp: new Date(),
        },
      ],
      currentTool: null,
    };
  }

  // Missing birth details guard
  if (!birthDetails && intent === "chart_request") {
    return {
      messages: [
        ...messages,
        {
          role: "assistant",
          content:
            "I'd love to read your chart! Could you share your date, time, and place of birth?",
          timestamp: new Date(),
        },
      ],
      currentTool: null,
    };
  }

  // Route to the right tool
  if (intent === "chart_request") {
    return { currentTool: "compute_birth_chart" };
  }

  if (intent === "daily_transit") {
    return { currentTool: "get_daily_transits" };
  }

  // Free form — use knowledge lookup
  return { currentTool: "knowledge_lookup" };
}