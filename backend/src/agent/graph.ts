import OpenAI from "openai";
import config from "../config/config.js";
import type { AgentState, ChartData } from "./state.js";
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
    return { toolOutput: null, resolvedLocation: state.resolvedLocation ?? null };
  }

  try {
    let toolOutput: any = null;
    let chartData: ChartData | null = state.chartData ?? null;
    let resolvedLocation = state.resolvedLocation ?? null;

    if (currentTool === "compute_birth_chart") {
      console.log("Geocoding...");
      const geo = await geocodePlace(birthDetails.place);
      console.log("Geo:", geo);
      resolvedLocation = {
        ...birthDetails,
        lat: geo.lat,
        lng: geo.lng,
        timezone: geo.timezone,
      };
      const enriched = { ...birthDetails, ...geo };
      console.log("Computing chart...");
      toolOutput = await computeBirthChart(enriched);
      chartData = toolOutput as ChartData;
      console.log("Chart computed.");
    }

    if (currentTool === "get_daily_transits") {
      const geo = await geocodePlace(birthDetails.place);
      resolvedLocation = {
        ...birthDetails,
        lat: geo.lat,
        lng: geo.lng,
        timezone: geo.timezone,
      };
      const enriched = { ...birthDetails, ...geo };
      // Reuse existing natal chart data instead of recomputing it
      const natalChart = chartData
        ? {
            planets: chartData.planets,
            ascendant: chartData.ascendant,
            houses: chartData.houses ?? [],
            rawData: chartData.rawData,
          }
        : null;
      toolOutput = await getDailyTransits(enriched, undefined, natalChart);
    }

    if (currentTool === "knowledge_lookup") {
      const lastMessage = state.messages[state.messages.length - 1];
      toolOutput = knowledgeLookup(lastMessage?.content ?? "");
    }

    return { toolOutput, chartData, resolvedLocation, currentTool: null };
  } catch (err: any) {
    return { error: err.message, toolOutput: null, chartData: null };
  }
}
async function llmWithRetry(payload: any, retries = 5): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await client.chat.completions.create(payload);
    } catch (err: any) {
      const isTransient = 
        !err.status || 
        err.status === 429 || 
        err.status >= 500 || 
        String(err.message || err).toLowerCase().includes("timeout") ||
        String(err.message || err).toLowerCase().includes("fetch") ||
        String(err.message || err).toLowerCase().includes("network");

      if (isTransient && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.warn(`Transient LLM error (status ${err.status}, msg: ${err.message}), retrying in ${delay.toFixed(0)}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error("LLM failure after retries or non-transient error:", err);
        throw err;
      }
    }
  }
}

async function llmWithRetryStream(payload: any, retries = 5): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await client.chat.completions.create({ ...payload, stream: true });
    } catch (err: any) {
      const isTransient = 
        !err.status || 
        err.status === 429 || 
        err.status >= 500 || 
        String(err.message || err).toLowerCase().includes("timeout") ||
        String(err.message || err).toLowerCase().includes("fetch") ||
        String(err.message || err).toLowerCase().includes("network");

      if (isTransient && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.warn(`Transient LLM stream error (status ${err.status}, msg: ${err.message}), retrying in ${delay.toFixed(0)}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error("LLM stream failure after retries or non-transient error:", err);
        throw err;
      }
    }
  }
}
function ensureAstrologyRedirect(text: string): string {
  const lower = text.toLowerCase();
  const hasAstrologyKeyword = 
    lower.includes("astrolog") || 
    lower.includes("birth chart") || 
    lower.includes("natal") || 
    lower.includes("transit") || 
    lower.includes("horoscope") || 
    lower.includes("cosmic") || 
    lower.includes("planet") || 
    lower.includes("star") || 
    lower.includes("zodiac") || 
    lower.includes("sky");

  if (!hasAstrologyKeyword) {
    return text + "\n\nLet's focus on the stars instead! Would you like to explore your birth chart or see today's planetary transits?";
  }
  return text;
}

async function llmNode(state: AgentState): Promise<Partial<AgentState>> {
  const { messages, toolOutput, birthDetails, resolvedLocation, error, chartData } = state;

  // Build ephemeris context: prefer fresh toolOutput from this turn,
  // but always fall back to persisted chartData from the DB.
  const ephemerisContext = toolOutput
    ? `Astronomical data from ephemeris (this turn): ${JSON.stringify(toolOutput)}`
    : chartData
      ? `Natal chart data (from prior computation): ${JSON.stringify(chartData)}`
      : "No astronomical data available yet.";

  const locationContext = resolvedLocation
    ? `Resolved location: place=${resolvedLocation.place}, lat=${resolvedLocation.lat}, lng=${resolvedLocation.lng}, timezone=${resolvedLocation.timezone}`
    : birthDetails
      ? `Birth place provided: ${birthDetails.place}. Coordinates/timezone have not yet been resolved.`
      : "No birth location provided yet.";

  const systemPrompt = `You are Astra, a calm and insightful astrology companion.

RULES:
- Only discuss astrology. For any other topic, redirect warmly.
- If you must refuse a request, or if the request is off-topic, always end your refusal/response with a warm redirect to astrology (e.g., "Let's explore your birth chart or today's planetary transits instead!").
- Always complete your response. Never trail off mid-sentence.
- Keep responses under 250 words unless the user asks for detail.
- Use short paragraphs. Avoid large tables or bullet walls.
- Speak in a warm, grounded tone — not dramatic, not vague.
- If birth details are missing and the question needs them, ask for them clearly.
- Never invent planetary positions — only interpret what the tool data says.
- Never give medical, financial, or legal advice even if framed astrologically.

CONTEXT:
${birthDetails ? `Birth details: date=${birthDetails.date}, time=${birthDetails.time}, place=${birthDetails.place}` : "No birth details provided yet."}
${locationContext}
${ephemerisContext}
${error ? `A tool error occurred: ${error}. Acknowledge gracefully.` : ""}

Respond conversationally. Ground every interpretation in the data above.`;

  const chatMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let reply = "";
  try {
    const response = await llmWithRetry({
      model: config.MODEL,
      max_tokens: 800,
      messages: [{ role: "system", content: systemPrompt }, ...chatMessages],
      stream: false,
    });
    reply = response.choices[0]?.message?.content ?? "I couldn't generate a response.";
  } catch (err: any) {
    const errMsg = String(err.message || err).toLowerCase();
    if (
      errMsg.includes("moderation") || 
      errMsg.includes("safety") || 
      errMsg.includes("blocked") || 
      errMsg.includes("policy") || 
      errMsg.includes("content") || 
      errMsg.includes("403") || 
      errMsg.includes("forbidden") ||
      errMsg.includes("moderated") ||
      errMsg.includes("violat")
    ) {
      reply = "I cannot fulfill this request as it goes against safety guidelines. Let's focus on astrology and exploring your birth chart or planetary transits!";
    } else {
      throw err;
    }
  }

  const isRefusal = 
    reply.toLowerCase().includes("cannot") || 
    reply.toLowerCase().includes("sorry") || 
    reply.toLowerCase().includes("unable") || 
    reply.toLowerCase().includes("don't have") || 
    reply.toLowerCase().includes("can't") || 
    reply.toLowerCase().includes("against my");

  if (state.intent === "off_topic" || isRefusal) {
    reply = ensureAstrologyRedirect(reply);
  }

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
    chartData: chartData ?? null,
    resolvedLocation: resolvedLocation ?? null,
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

/**
 * Streaming variant: runs router → reason → tool deterministically,
 * then streams the LLM reply token-by-token via onToken callback.
 * Resolves with the final AgentState once streaming is complete.
 */
export async function runAgentStream(
  state: AgentState,
  onToken: (token: string) => void,
  onToolActivity?: (toolName: string) => void
): Promise<AgentState> {
  // Step 1: Route
  const afterRouter = { ...state, ...(await routerNode(state)) };

  // Step 2: Reason (may short-circuit with an assistant reply for off_topic / missing details)
  const afterReason = { ...afterRouter, ...(await reasonNode(afterRouter)) };

  // If reasonNode already appended an assistant reply (e.g. off_topic), stream it char-by-char
  const reasonAdded = afterReason.messages.length > afterRouter.messages.length;
  if (reasonAdded) {
    const reply = afterReason.messages[afterReason.messages.length - 1]?.content ?? "";
    for (const ch of reply) {
      onToken(ch);
    }
    return afterReason;
  }

  // Step 3: Tool
  let afterTool = afterReason;
  if (afterReason.currentTool) {
    onToolActivity?.(afterReason.currentTool);
    afterTool = { ...afterReason, ...(await toolNode(afterReason)) };
  }

  // Step 4: Stream LLM
  const { messages, toolOutput, birthDetails, error, chartData } = afterTool;
  const { resolvedLocation } = afterTool;

  const ephemerisContext = toolOutput
    ? `Astronomical data from ephemeris (this turn): ${JSON.stringify(toolOutput)}`
    : chartData
      ? `Natal chart data (from prior computation): ${JSON.stringify(chartData)}`
      : "No astronomical data available yet.";

  const locationContext = resolvedLocation
    ? `Resolved location: place=${resolvedLocation.place}, lat=${resolvedLocation.lat}, lng=${resolvedLocation.lng}, timezone=${resolvedLocation.timezone}`
    : birthDetails
      ? `Birth place provided: ${birthDetails.place}. Coordinates/timezone have not yet been resolved.`
      : "No birth location provided yet.";

  const systemPrompt = `You are Astra, a calm and insightful astrology companion.

RULES:
- Only discuss astrology. For any other topic, redirect warmly.
- If you must refuse a request, or if the request is off-topic, always end your refusal/response with a warm redirect to astrology (e.g., "Let's explore your birth chart or today's planetary transits instead!").
- Always complete your response. Never trail off mid-sentence.
- Keep responses under 250 words unless the user asks for detail.
- Use short paragraphs. Avoid large tables or bullet walls.
- Speak in a warm, grounded tone — not dramatic, not vague.
- If birth details are missing and the question needs them, ask for them clearly.
- Never invent planetary positions — only interpret what the tool data says.
- Never give medical, financial, or legal advice even if framed astrologically.

CONTEXT:
${birthDetails ? `Birth details: date=${birthDetails.date}, time=${birthDetails.time}, place=${birthDetails.place}` : "No birth details provided yet."}
${locationContext}
${ephemerisContext}
${error ? `A tool error occurred: ${error}. Acknowledge gracefully.` : ""}

Respond conversationally. Ground every interpretation in the data above.`;

  const chatMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let fullReply = "";
  try {
    const stream = await llmWithRetryStream({
      model: config.MODEL,
      max_tokens: 800,
      messages: [{ role: "system", content: systemPrompt }, ...chatMessages],
    });

    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content ?? "";
      if (token) {
        fullReply += token;
        onToken(token);
      }
    }
  } catch (err: any) {
    const errMsg = String(err.message || err).toLowerCase();
    if (
      errMsg.includes("moderation") || 
      errMsg.includes("safety") || 
      errMsg.includes("blocked") || 
      errMsg.includes("policy") || 
      errMsg.includes("content") || 
      errMsg.includes("403") || 
      errMsg.includes("forbidden") ||
      errMsg.includes("moderated") ||
      errMsg.includes("violat")
    ) {
      const safetyReply = "I cannot fulfill this request as it goes against safety guidelines. Let's focus on astrology and exploring your birth chart or planetary transits!";
      fullReply = safetyReply;
      for (const ch of safetyReply) {
        onToken(ch);
      }
    } else {
      throw err;
    }
  }

  if (!fullReply) fullReply = "I couldn't generate a response.";

  const isRefusal = 
    fullReply.toLowerCase().includes("cannot") || 
    fullReply.toLowerCase().includes("sorry") || 
    fullReply.toLowerCase().includes("unable") || 
    fullReply.toLowerCase().includes("don't have") || 
    fullReply.toLowerCase().includes("can't") || 
    fullReply.toLowerCase().includes("against my");

  if (afterTool.intent === "off_topic" || isRefusal) {
    const originalLength = fullReply.length;
    fullReply = ensureAstrologyRedirect(fullReply);
    if (fullReply.length > originalLength) {
      const extra = fullReply.slice(originalLength);
      for (const ch of extra) {
        onToken(ch);
      }
    }
  }

  return {
    ...afterTool,
    messages: [
      ...messages,
      {
        role: "assistant",
        content: fullReply,
        timestamp: new Date(),
      },
    ],
    toolOutput: null,
    chartData: chartData ?? null,
    resolvedLocation: resolvedLocation ?? null,
    error: null,
  };
}

export async function extractBirthDetails(message: string): Promise<{ date: string; time: string; place: string } | null> {
  try {
    const response = await client.chat.completions.create({
      model: config.MODEL,
      messages: [
        {
          role: "system",
          content: `You are an expert birth details extractor. Your job is to extract the date, time, and place of birth from the user's message.
Return ONLY a valid JSON object with the following fields:
{
  "date": "YYYY-MM-DD", // standard format (e.g. 1995-06-15)
  "time": "HH:MM", // 24-hour format (e.g. 10:30)
  "place": "City, Country" // e.g. Hyderabad, India
}
If any of these three fields (date, time, place) are missing, or cannot be confidently extracted, return {"error": "incomplete"}. Do not return any other text, markdown formatting, or explanation. Only JSON.`
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 150,
      temperature: 0,
      response_format: { type: "json_object" }
    });

    let content = response.choices[0]?.message?.content?.trim() || "";
    // Clean potential markdown wrap
    if (content.startsWith("```json")) {
      content = content.slice(7);
    }
    if (content.endsWith("```")) {
      content = content.slice(0, -3);
    }
    content = content.trim();
    
    const parsed = JSON.parse(content);
    if (parsed && parsed.date && parsed.time && parsed.place && !parsed.error) {
      return {
        date: parsed.date,
        time: parsed.time,
        place: parsed.place
      };
    }
  } catch (err) {
    console.error("Failed to extract birth details:", err);
  }
  return null;
}
