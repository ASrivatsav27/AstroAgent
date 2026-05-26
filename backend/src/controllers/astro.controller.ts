import type { Request, Response } from "express";
import { computeBirthChart } from "../agent/tools/birthChart.js";
import { geocodePlace } from "../agent/tools/geocodePlace.js";
import { runAgent } from "../agent/graph.js";
import type { AgentState } from "../agent/state.js";

export async function birthChartController(req: Request, res: Response) {
  try {
    const { date, time, place } = req.body;

    if (!date || !time || !place) {
      return res.status(400).json({ error: "date, time and place are required" });
    }

    // geocode first
    const geo = await geocodePlace(place);

    const chart = await computeBirthChart({
      date,
      time,
      place,
      lat: geo.lat,
      lng: geo.lng,
      timezone: geo.timezone,
    });

    res.json({ chart, geo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function chatController(req: Request, res: Response) {
  try {
    const { message, birthDetails, userId, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const state: AgentState = {
      messages: [
        ...(history ?? []),
        {
          role: "user",
          content: message,
          timestamp: new Date(),
        },
      ],
      birthDetails: birthDetails ?? null,
      currentTool: null,
      toolOutput: null,
      intent: null,
      error: null,
      userId: userId ?? null,
    };

    const result = await runAgent(state);

    const lastMessage = result.messages[result.messages.length - 1];

    res.json({
      reply: lastMessage?.content,
      intent: result.intent,
      toolOutput: result.toolOutput,
      messages: result.messages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}