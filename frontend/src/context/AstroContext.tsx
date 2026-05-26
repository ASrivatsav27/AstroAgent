import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BirthDetails = {
  date: string;
  time: string;
  place: string;
  lat?: number;
  lng?: number;
  timezone?: string;
};

export type ChartPlanet = {
  planet: string;
  sign: string;
  degree: number;
  house: number;
};

export type ChartData = {
  planets: ChartPlanet[];
  ascendant: string;
  houses?: string[];
  rawData?: unknown;
};

export type Message = {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: string;
  toolCall?: string;
};

type AstroContextValue = {
  userId: string;
  birthDetails: BirthDetails | null;
  setBirthDetails: (details: BirthDetails | null) => void;
  chartData: ChartData | null;
  setChartData: (data: ChartData | null) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  error: string | null;
  setError: (value: string | null) => void;
};

const AstroContext = createContext<AstroContextValue | undefined>(undefined);

export function AstroProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState("");
  const [birthDetails, setBirthDetails] = useState<BirthDetails | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("astro_userId");
    if (stored) {
      setUserId(stored);
      return;
    }

    const newId = crypto.randomUUID();
    localStorage.setItem("astro_userId", newId);
    setUserId(newId);
  }, []);

  const value = useMemo(
    () => ({
      userId,
      birthDetails,
      setBirthDetails,
      chartData,
      setChartData,
      messages,
      setMessages,
      isLoading,
      setIsLoading,
      error,
      setError,
    }),
    [userId, birthDetails, chartData, messages, isLoading, error]
  );

  return <AstroContext.Provider value={value}>{children}</AstroContext.Provider>;
}

export function useAstro() {
  const context = useContext(AstroContext);
  if (!context) {
    throw new Error("useAstro must be used within AstroProvider");
  }
  return context;
}
