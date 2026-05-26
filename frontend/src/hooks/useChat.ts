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
  // Track the index of the currently-streaming assistant message
  const streamingIndexRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    streamingIndexRef.current = null;
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
    setIsLoading(true);
    setError(null);

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
          setIsLoading(false);
        },
        controller.signal
      );
    } catch (err: unknown) {
      // AbortError is expected when user stops generation
      if (err instanceof Error && (err.name === "AbortError" || err.name === "CanceledError")) {
        setIsLoading(false);
        return;
      }
      const message = err instanceof Error ? err.message : "Unable to send message";
      setError(message);
      setIsLoading(false);
    }
  };

  const isTyping = isLoading && messages[messages.length - 1]?.role === "assistant";

  return { sendMessage, stopGeneration, isLoading, isTyping, error, messages };
}
