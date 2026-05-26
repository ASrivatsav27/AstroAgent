import type { AgentState } from "../state.js";


export async function routerNode(state: AgentState): Promise<Partial<AgentState>> {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) {
        return {intent : "free_form"}
    }
  const text = lastMessage.content.toLowerCase();

  // Off-topic guard first
  if (
    text.includes("stock") ||
    text.includes("invest") ||
    text.includes("medicine") ||
    text.includes("diagnosis") ||
    text.includes("ignore previous") ||
    text.includes("python") ||
    text.includes("javascript") ||
    text.includes("typescript") ||
    text.includes("code") ||
    text.includes("program") ||
    text.includes("snippet") ||
    text.includes("function") ||
    text.includes("add two numbers") ||
    text.includes("compile") ||
    text.includes("debug")
  ) {
    return { intent: "off_topic" };
  }

  // Daily transit — questions about today / current sky
  if (
    text.includes("today") ||
    text.includes("transit") ||
    text.includes("retrograde") ||
    text.includes("current sky") ||
    text.includes("current planets") ||
    text.includes("this week") ||
    text.includes("this month") ||
    text.includes("energy today") ||
    text.includes("what's happening")
  ) {
    return { intent: "daily_transit" };
  }

  // Chart request — questions about the user's natal chart / placements
  if (
    text.includes("birth chart") ||
    text.includes("natal") ||
    text.includes("my chart") ||
    text.includes("my sign") ||
    text.includes("my sun") ||
    text.includes("my moon") ||
    text.includes("my rising") ||
    text.includes("my venus") ||
    text.includes("my mars") ||
    text.includes("my mercury") ||
    text.includes("my jupiter") ||
    text.includes("my saturn") ||
    text.includes("my ascendant") ||
    text.includes("my placement") ||
    text.includes("my house") ||
    text.includes("moon sign") ||
    text.includes("sun sign") ||
    text.includes("rising sign") ||
    text.includes("ascendant") ||
    text.includes("what sign am i") ||
    text.includes("what's my") ||
    text.includes("what is my") ||
    text.includes("tell me about my") ||
    text.includes("read my chart") ||
    text.includes("compute my") ||
    text.includes("calculate my") ||
    text.includes("show my") ||
    /\bmy (sun|moon|venus|mars|mercury|jupiter|saturn|uranus|neptune|pluto|rising|ascendant|chart|planets?)\b/.test(text)
  ) {
    return { intent: "chart_request" };
  }

  return { intent: "free_form" };
}