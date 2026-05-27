import { useEffect, useRef } from "react";
import { sendMessageStream } from "../services/api";
import { useAstro } from "../context/AstroContext";

export function useChat() {
  const {
    userId,
    birthDetails,
    messages,
    setMessages,
    setChartData,
    isLoading,
    setIsLoading,
    error,
    setError,
  } = useAstro();

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStreamFinishedRef = useRef(false);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    hasStreamFinishedRef.current = true;
    setIsLoading(false);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !userId) return;

    // Abort any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage = {
      role: "user" as const,
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // If the user's message likely triggers a tool (birth chart / transits / geocode),
    // insert an optimistic pending tool bubble so the UI shows activity immediately.
    const likelyToolTrigger = /\b(birth|chart|transit|transits|geocode|timezone|latitude|longitude|place|where|born)\b/i;
    if (likelyToolTrigger.test(trimmed)) {
      const pendingTool = {
        role: "tool" as const,
        content: "__TOOL_PENDING__",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, pendingTool]);
    }
    setIsLoading(true);
    setError(null);
    hasStreamFinishedRef.current = false;

    try {
      await sendMessageStream(
        userId,
        trimmed,
        birthDetails,
        // onToken — append each token directly into the streaming message, creating it on the first token
        (token) => {
          setMessages((prev) => {
            const next = [...prev];
            const lastUserIdx = next.map((m) => m.role).lastIndexOf("user");
            
            // Search for assistant message strictly in the current turn (after the last user message)
            let idx = -1;
            for (let i = next.length - 1; i > lastUserIdx; i--) {
              if (next[i]?.role === "assistant") {
                idx = i;
                break;
              }
            }

            if (idx === -1) {
              const assistantPlaceholder = {
                role: "assistant" as const,
                content: token,
                timestamp: new Date().toISOString(),
              };
              return [...prev, assistantPlaceholder];
            }
            next[idx] = { ...next[idx]!, content: next[idx]!.content + token };
            return next;
          });
        },
        // onToolActivity — insert a visible tool-activity message
        (toolName) => {
          const toolMsg = {
            role: "tool" as const,
            content: toolName,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => {
            // If we previously inserted a pending placeholder, replace it with the real tool name.
            const pendingIdx = prev.findIndex((m) => m.role === "tool" && m.content === "__TOOL_PENDING__");
            if (pendingIdx !== -1) {
              const next = [...prev];
              next[pendingIdx] = toolMsg;
              return next;
            }

            const lastUserIdx = prev.map((m) => m.role).lastIndexOf("user");

            // Search for assistant message strictly in the current turn (after the last user message)
            let idx = -1;
            for (let i = prev.length - 1; i > lastUserIdx; i--) {
              if (prev[i]?.role === "assistant") {
                idx = i;
                break;
              }
            }

            if (idx === -1) return [...prev, toolMsg];
            const next = [...prev];
            next.splice(idx, 0, toolMsg);
            return next;
          });
        },
        // onDone — update chart data and clear loading state
        (payload) => {
          if (payload.chartData) {
            setChartData(payload.chartData);
          }
          hasStreamFinishedRef.current = true;
          setIsLoading(false);
        },
        controller.signal
      );
      if (!hasStreamFinishedRef.current) {
        setIsLoading(false);
      }
    } catch (err: unknown) {
      // AbortError is expected when user stops generation
      if (err instanceof Error && (err.name === "AbortError" || err.name === "CanceledError")) {
        setIsLoading(false);
        return;
      }
      const message = err instanceof Error ? err.message : "Unable to send message";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant" as const,
          content: "I hit a connection issue while sending that. Please try again in a moment.",
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsLoading(false);
    }
  };

  const isTyping = isLoading && messages[messages.length - 1]?.role === "assistant";

  return { sendMessage, stopGeneration, isLoading, isTyping, error, messages };
}
