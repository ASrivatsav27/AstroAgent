import type { Request, Response } from "express";
import { computeBirthChart } from "../agent/tools/birthChart.js";
import { geocodePlace } from "../agent/tools/geocodePlace.js";
import { runAgent } from "../agent/graph.js";
import type { AgentState } from "../agent/state.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";

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
    const { message, birthDetails } = req.body;
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";

    if (!message || String(message).trim().length === 0) {
      return res.status(400).json({ error: "message is required" });
    }

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const conversation =
      (await Conversation.findOne({ userId })) ??
      new Conversation({ userId, messages: [] });

    const user = await User.findOne({ userId });
    const resolvedBirthDetails = birthDetails ?? user?.birthDetails ?? null;

    if (birthDetails && !user?.birthDetails) {
      await User.findOneAndUpdate(
        { userId },
        { birthDetails },
        { upsert: true, returnDocument: "after" }
      );
    }

    const historyMessages = conversation.messages.map((m) => {
      const base = {
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      };

      return m.toolCall ? { ...base, toolCall: m.toolCall } : base;
    });

    const state: AgentState = {
      messages: [
        ...historyMessages,
        {
          role: "user",
          content: String(message),
          timestamp: new Date(),
        },
      ],
      birthDetails: resolvedBirthDetails,
      currentTool: null,
      toolOutput: null,
      chartData: null,
      intent: null,
      error: null,
      userId: userId ?? null,
    };

    const result = await runAgent(state);

    conversation.messages = result.messages.map((m) => {
      const base = {
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      };

      return m.toolCall ? { ...base, toolCall: m.toolCall } : base;
    }) as typeof conversation.messages;
    conversation.updatedAt = new Date();
    await conversation.save();

    if (result.chartData) {
      await User.findOneAndUpdate(
        { userId },
        { chartData: result.chartData },
        { returnDocument: "after" }
      );
    }

    const lastMessage = result.messages[result.messages.length - 1];

    res.json({
      reply: lastMessage?.content,
      intent: result.intent,
      chartData: result.chartData ?? null,
      messages: result.messages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function saveBirthDetails(req: Request, res: Response) {
  try {
    const { birthDetails } = req.body;
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";

    if (!userId || !birthDetails) {
      return res.status(400).json({ error: "userId and birthDetails required" });
    }

    const user = await User.findOneAndUpdate(
      { userId },
      { birthDetails },
      { upsert: true, returnDocument: "after" }
    );

    res.json({ success: true, user });
  } catch (err: any) {
    console.error("saveBirthDetails error:", err?.message ?? err, err?.stack);
    res.status(500).json({ error: err.message });
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const userId = typeof req.params.userId === "string" ? req.params.userId : "";
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const user = await User.findOne({ userId });

    res.json({
      birthDetails: user?.birthDetails ?? null,
      chartData: user?.chartData ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getConversation(req: Request, res: Response) {
  try {
    const userId = typeof req.params.userId === "string" ? req.params.userId : "";
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const conversation = await Conversation.findOne({ userId });

    res.json({ messages: conversation?.messages ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}