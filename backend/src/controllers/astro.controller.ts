import type { Request, Response } from "express";
import { computeBirthChart } from "../agent/tools/birthChart.js";
import { geocodePlace } from "../agent/tools/geocodePlace.js";
import { runAgent, runAgentStream, extractBirthDetails } from "../agent/graph.js";
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

function likelyContainsBirthDetails(msg: string): boolean {
  const text = msg.toLowerCase();
  
  // Must mention birth/born/details/chart/time/place/date/timezone/latitude/longitude
  const hasKeywords = 
    text.includes("born") || 
    text.includes("birth") || 
    text.includes("date") ||
    text.includes("time") || 
    text.includes("place") || 
    text.includes("location") || 
    text.includes("timezone");

  if (!hasKeywords) return false;

  // Should also contain some numbers or date indicators
  const hasNumbers = /\b\d{1,4}\b/.test(text);
  const hasMonths = /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/.test(text);

  return hasNumbers || hasMonths;
}

export async function chatController(req: Request, res: Response) {
  try {
    const { message, birthDetails } = req.body;
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (message === undefined || message === null || String(message).trim().length === 0) {
      const user = await User.findOne({ userId });
      return res.json({
        reply: "Please enter a message or question so I can assist you with your astrological journey!",
        intent: "free_form",
        chartData: user?.chartData ?? null,
        messages: [],
      });
    }

    const conversation =
      (await Conversation.findOne({ userId })) ??
      new Conversation({ userId, messages: [] });

    let user = await User.findOne({ userId });
    let resolvedBirthDetails = birthDetails ?? user?.birthDetails ?? null;
    let chartData = user?.chartData ?? null;

    if (likelyContainsBirthDetails(message)) {
      const extracted = await extractBirthDetails(message);
      if (extracted) {
        const isDifferent = !user?.birthDetails || 
          user.birthDetails.date !== extracted.date ||
          user.birthDetails.time !== extracted.time ||
          user.birthDetails.place !== extracted.place;

        if (isDifferent) {
          chartData = null;
          user = await User.findOneAndUpdate(
            { userId },
            { birthDetails: extracted, $unset: { chartData: 1 } },
            { upsert: true, new: true, returnDocument: "after" }
          );
        } else {
          user = await User.findOneAndUpdate(
            { userId },
            { birthDetails: extracted },
            { upsert: true, new: true, returnDocument: "after" }
          );
        }
        resolvedBirthDetails = extracted;
      }
    } else if (birthDetails && !user?.birthDetails) {
      user = await User.findOneAndUpdate(
        { userId },
        { birthDetails },
        { upsert: true, new: true, returnDocument: "after" }
      );
      resolvedBirthDetails = birthDetails;
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
      chartData: chartData,
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
    const errMsg = String(err.message || err).toLowerCase();
    const isModeration = errMsg.includes("moderation") || 
                         errMsg.includes("safety") || 
                         errMsg.includes("blocked") || 
                         errMsg.includes("policy") || 
                         errMsg.includes("content") || 
                         errMsg.includes("403") || 
                         errMsg.includes("forbidden") ||
                         errMsg.includes("moderated") ||
                         errMsg.includes("violat");

    if (isModeration) {
      return res.json({
        reply: "I cannot fulfill this request as it goes against safety guidelines. Let's focus on astrology and exploring your birth chart or planetary transits!",
        intent: "off_topic",
        chartData: null,
        messages: [],
      });
    }
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

export async function chatStreamController(req: Request, res: Response) {
  const { message, birthDetails } = req.body;
  const userId = typeof req.body.userId === "string" ? req.body.userId : "";

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const user = await User.findOne({ userId });

  if (message === undefined || message === null || String(message).trim().length === 0) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    send({ token: "Please enter a message or question so I can assist you with your astrological journey!" });
    send({ done: true, intent: "free_form", chartData: user?.chartData ?? null });
    res.end();
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const conversation =
      (await Conversation.findOne({ userId })) ??
      new Conversation({ userId, messages: [] });

    let user = await User.findOne({ userId });
    let resolvedBirthDetails = birthDetails ?? user?.birthDetails ?? null;
    let chartData = user?.chartData ?? null;

    if (likelyContainsBirthDetails(message)) {
      const extracted = await extractBirthDetails(message);
      if (extracted) {
        const isDifferent = !user?.birthDetails || 
          user.birthDetails.date !== extracted.date ||
          user.birthDetails.time !== extracted.time ||
          user.birthDetails.place !== extracted.place;

        if (isDifferent) {
          chartData = null;
          user = await User.findOneAndUpdate(
            { userId },
            { birthDetails: extracted, $unset: { chartData: 1 } },
            { upsert: true, new: true, returnDocument: "after" }
          );
        } else {
          user = await User.findOneAndUpdate(
            { userId },
            { birthDetails: extracted },
            { upsert: true, new: true, returnDocument: "after" }
          );
        }
        resolvedBirthDetails = extracted;
      }
    } else if (birthDetails && !user?.birthDetails) {
      user = await User.findOneAndUpdate(
        { userId },
        { birthDetails },
        { upsert: true, new: true, returnDocument: "after" }
      );
      resolvedBirthDetails = birthDetails;
    }

    const historyMessages = conversation.messages.map((m) => {
      const base = { role: m.role, content: m.content, timestamp: m.timestamp };
      return m.toolCall ? { ...base, toolCall: m.toolCall } : base;
    });

    const state: AgentState = {
      messages: [
        ...historyMessages,
        { role: "user", content: String(message), timestamp: new Date() },
      ],
      birthDetails: resolvedBirthDetails,
      currentTool: null,
      toolOutput: null,
      chartData: chartData,
      intent: null,
      error: null,
      userId: userId ?? null,
    };

    const result = await runAgentStream(
      state,
      (token) => send({ token }),
      (toolName) => send({ tool_activity: toolName })
    );

    // Persist conversation
    conversation.messages = result.messages.map((m) => {
      const base = { role: m.role, content: m.content, timestamp: m.timestamp };
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

    send({ done: true, intent: result.intent, chartData: result.chartData ?? null });
    res.end();
  } catch (err: any) {
    const errMsg = String(err.message || err).toLowerCase();
    const isModeration = errMsg.includes("moderation") || 
                         errMsg.includes("safety") || 
                         errMsg.includes("blocked") || 
                         errMsg.includes("policy") || 
                         errMsg.includes("content") || 
                         errMsg.includes("403") || 
                         errMsg.includes("forbidden") ||
                         errMsg.includes("moderated") ||
                         errMsg.includes("violat");

    if (isModeration) {
      send({
        token: "I cannot fulfill this request as it goes against safety guidelines. Let's focus on astrology and exploring your birth chart or planetary transits!",
        intent: "off_topic"
      });
      send({ done: true, intent: "off_topic", chartData: null });
      res.end();
      return;
    }
    send({ error: err.message });
    res.end();
  }
}