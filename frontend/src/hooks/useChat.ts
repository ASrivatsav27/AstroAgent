import { useEffect, useRef, useState } from "react";
import { sendMessage as sendMessageApi } from "../services/api";
import { useAstro } from "../context/AstroContext";

export function useChat() {
  const {
    userId,
    messages,
    setMessages,
    setChartData,
    isLoading,
    setIsLoading,
    error,
    setError,
  } = useAstro();
  const [isTyping, setIsTyping] = useState(false);
  const typingIndexRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !userId) {
      return;
    }

    const userMessage = {
      role: "user" as const,
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendMessageApi(userId, trimmed);
      const reply = response.reply ?? "";

      if (response.chartData) {
        setChartData(response.chartData);
      }

      const assistantMessage = {
        role: "assistant" as const,
        content: "",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => {
        const next = [...prev, assistantMessage];
        typingIndexRef.current = next.length - 1;
        return next;
      });
      setIsTyping(true);

      let index = 0;
      let current = "";

      intervalRef.current = window.setInterval(() => {
        if (index >= reply.length) {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
          }
          intervalRef.current = null;
          setIsTyping(false);
          setIsLoading(false);
          return;
        }

        current += reply.charAt(index);
        index += 1;

        setMessages((prev) => {
          const next = [...prev];
          const targetIndex = typingIndexRef.current;
          if (targetIndex === null || !next[targetIndex]) {
            return prev;
          }
          next[targetIndex] = { ...next[targetIndex], content: current };
          return next;
        });
      }, 18);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to send message";
      setError(message);
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  return { sendMessage, isLoading, isTyping, error };
}
