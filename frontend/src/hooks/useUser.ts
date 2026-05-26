import { useEffect, useState } from "react";
import { getConversation, getUser } from "../services/api";
import { useAstro } from "../context/AstroContext";

export function useUser() {
  const { userId, setBirthDetails, setChartData, setMessages, setError } = useAstro();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    Promise.all([getUser(userId), getConversation(userId)])
      .then(([userData, convo]) => {
        if (!isMounted) {
          return;
        }
        setBirthDetails(userData.birthDetails ?? null);
        setChartData(userData.chartData ?? null);
        setMessages(convo.messages ?? []);
      })
      .catch((err: unknown) => {
        if (!isMounted) {
          return;
        }
        const message = err instanceof Error ? err.message : "Unable to load user";
        setError(message);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userId, setBirthDetails, setChartData, setMessages, setError]);

  return { isLoading };
}
