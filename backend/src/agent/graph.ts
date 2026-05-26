import OpenAI from "openai";
import config from "../config/config.js";
import type { AgentState } from "./state.js";
import { routerNode } from "./nodes/routerNode.js";
import { reasonNode } from "./nodes/reasonNode.js";
import { computeBirthChart } from "./tools/birthChart.js";
import { getDailyTransits } from "./tools/dailyTransits.js";
import { geocodePlace } from "./tools/geocodePlace.js";
import { knowledgeLookup } from "./tools/knowledgeLookup.js";

const client = new OpenAI({
  baseURL: config.OPENROUTER_BASE_URL,
  apiKey: config.OPENROUTER_API_KEY,
});

async function toolNode(state: AgentState): Promise<Partial<AgentState>> {
  const { currentTool, birthDetails } = state;

  if (!currentTool || !birthDetails) {
    return { toolOutput: null };
  }

  try {
    let toolOutput: any = null;

if (currentTool === "compute_birth_chart") {
  console.log("Geocoding...");
  const geo = await geocodePlace(birthDetails.place);
  console.log("Geo:", geo);
  const enriched = { ...birthDetails, ...geo };
  console.log("Computing chart...");
  toolOutput = await computeBirthChart(enriched);
  console.log("Chart:", toolOutput);
}

    if (currentTool === "get_daily_transits") {
      const geo = await geocodePlace(birthDetails.place);
      const enriched = { ...birthDetails, ...geo };
      toolOutput = await getDailyTransits(enriched);
    }

    if (currentTool === "knowledge_lookup") {
      const lastMessage = state.messages[state.messages.length - 1];
      toolOutput = knowledgeLookup(lastMessage?.content ?? "");
    }

    return { toolOutput, currentTool: null };
  } catch (err: any) {
    return { error: err.message, toolOutput: null };
  }
}
async function llmWithRetry(payload: any, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await client.chat.completions.create(payload);
    } catch (err: any) {
      if (err.status === 429 && i < retries - 1) {
        console.log(`Rate limited, retrying in ${(i + 1) * 2}s...`);
        await new Promise(r => setTimeout(r, (i + 1) * 2000));
      } else {
        throw err;
      }
    }
  }
}
async function llmNode(state: AgentState): Promise<Partial<AgentState>> {
  const { messages, toolOutput, birthDetails, error } = state;

  const systemPrompt = `You are Astra, a calm and insightful astrology companion.

RULES:
- Only discuss astrology. For any other topic, redirect warmly.
- Always complete your response. Never trail off mid-sentence.
- Keep responses under 250 words unless the user asks for detail.
- Use short paragraphs. Avoid large tables or bullet walls.
- Speak in a warm, grounded tone — not dramatic, not vague.
- If birth details are missing and the question needs them, ask for them clearly.
- Never invent planetary positions — only interpret what the tool data says.
- Never give medical, financial, or legal advice even if framed astrologically.

CONTEXT:
${birthDetails ? `Birth details: date=${birthDetails.date}, time=${birthDetails.time}, place=${birthDetails.place}` : "No birth details provided yet."}
${toolOutput ? `Astronomical data from ephemeris: ${JSON.stringify(toolOutput)}` : "No tool data available."}
${error ? `A tool error occurred: ${error}. Acknowledge gracefully.` : ""}

Respond conversationally. Ground every interpretation in the tool data above.`;

  const chatMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const response = await llmWithRetry({
  model: config.MODEL,
  max_tokens: 800,
  messages: [{ role: "system", content: systemPrompt }, ...chatMessages],
  stream: false,
});
  const reply = response.choices[0]?.message?.content ?? "I couldn't generate a response.";

  return {
    messages: [
      ...messages,
      {
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      },
    ],
    toolOutput: null,
    error: null,
  };
}

export async function runAgent(state: AgentState): Promise<AgentState> {
  console.log("Step 1: routing...");
  const afterRouter = { ...state, ...(await routerNode(state)) };
  console.log("Intent:", afterRouter.intent);

  console.log("Step 2: reasoning...");
  const afterReason = { ...afterRouter, ...(await reasonNode(afterRouter)) };
  console.log("Tool selected:", afterReason.currentTool);

  console.log("Step 3: running tool...");
  let afterTool = afterReason;
  if (afterReason.currentTool) {
    afterTool = { ...afterReason, ...(await toolNode(afterReason)) };
  }
  console.log("Tool output:", afterTool.toolOutput);

  console.log("Step 4: LLM...");
  const afterLLM = { ...afterTool, ...(await llmNode(afterTool)) };
  console.log("Done.");

  return afterLLM;
}
