import type { AgentState } from "../state.js";

export async function reasonNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, birthDetails, chartData, messages } = state;

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

  // Chart request path
  if (intent === "chart_request") {
    // No birth details — ask for them
    if (!birthDetails) {
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
    // Have birth details — compute the chart (always refresh on explicit chart request)
    return { currentTool: "compute_birth_chart" };
  }

  // Daily transit path
  if (intent === "daily_transit") {
    if (!birthDetails) {
      return {
        messages: [
          ...messages,
          {
            role: "assistant",
            content:
              "To personalise today's transits for you, I'll need your birth date, time, and place. Could you share those?",
            timestamp: new Date(),
          },
        ],
        currentTool: null,
      };
    }
    return { currentTool: "get_daily_transits" };
  }

  // Free-form — only compute birth chart if we genuinely don't have it yet.
  // If chartData is already loaded from DB (or a prior turn), skip the ephemeris call.
  if (intent === "free_form" && birthDetails && !chartData) {
    return { currentTool: "compute_birth_chart" };
  }

  // Free form with chart data already present — use knowledge lookup to supplement.
  // The LLM will see the persisted chartData via the system prompt.
  return { currentTool: "knowledge_lookup" };
}