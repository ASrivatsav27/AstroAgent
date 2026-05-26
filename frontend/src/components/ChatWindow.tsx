import { useEffect, useMemo, useRef, useState } from "react";
import { useAstro } from "../context/AstroContext";
import { useChat } from "../hooks/useChat";
import LoadingDots from "./LoadingDots";
import MessageBubble from "./MessageBubble";

/* ─── Planet data ─── */
const PLANETS = {
  sun:     { name: "Sun",     symbol: "☉", color: "#D4A021" },
  moon:    { name: "Moon",    symbol: "☽", color: "#8B7EB8" },
  mercury: { name: "Mercury", symbol: "☿", color: "#5BA37E" },
  venus:   { name: "Venus",   symbol: "♀", color: "#C47A9E" },
  mars:    { name: "Mars",    symbol: "♂", color: "#C05D5D" },
  jupiter: { name: "Jupiter", symbol: "♃", color: "#C4A265" },
  saturn:  { name: "Saturn",  symbol: "♄", color: "#8B7355" },
  uranus:  { name: "Uranus",  symbol: "♅", color: "#5B9EA6" },
  neptune: { name: "Neptune", symbol: "♆", color: "#7C5CBA" },
  pluto:   { name: "Pluto",   symbol: "♇", color: "#9B6FB0" },
} as const;

type PlanetKey = keyof typeof PLANETS;
const planetKeys = Object.keys(PLANETS) as PlanetKey[];

const detectPlanets = (text: string): PlanetKey[] => {
  const lower = text.toLowerCase();
  return planetKeys.filter(key => new RegExp(`\\b${key}\\b`, "i").test(lower));
};

export default function ChatWindow() {
  const { messages, chartData } = useAstro();
  const { sendMessage, isLoading, isTyping, error, stopGeneration } = useChat();
  const [input, setInput] = useState("");
  const [activePlanets, setActivePlanets] = useState<PlanetKey[]>([]);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastHighlightRef = useRef<string>("");
  const clearTimerRef = useRef<number | null>(null);

  // Smooth scroll when a new message bubble is added
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Instant scroll on every char update while typing so it tracks the output
  useEffect(() => {
    if (isTyping) {
      endRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages, isTyping]);

  /* Detect planet mentions */
  useEffect(() => {
    if (isTyping) return;
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
    const content = lastAssistant?.content ?? "";
    if (!content || content === lastHighlightRef.current) return;
    lastHighlightRef.current = content;
    const found = detectPlanets(content);
    if (found.length > 0) {
      setActivePlanets(found);
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => setActivePlanets([]), 6000);
    }
  }, [messages, isTyping]);

  useEffect(() => () => { if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current); }, []);

  const planets = chartData?.planets ?? [];
  const ascendant = chartData?.ascendant ?? "";
  const sunSign = useMemo(() => planets.find(p => p.planet.toLowerCase() === "sun")?.sign ?? "", [planets]);
  const moonSign = useMemo(() => planets.find(p => p.planet.toLowerCase() === "moon")?.sign ?? "", [planets]);

  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) { if (messages[i]?.role === "assistant") return i; }
    return -1;
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    await sendMessage(trimmed);
  };

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  /* ─── Sidebar content ─── */
  const sidebarContent = (
    <>
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: "var(--gold)", fontSize: "18px" }}>✦</span>
          <span className="font-serif" style={{ fontSize: "22px", fontWeight: 600, color: "var(--text)" }}>
            Astra
          </span>
        </div>
        {chartData && (
          <p className="font-mono" style={{ fontSize: "12px", color: "var(--purple)", lineHeight: 1.6 }}>
            ☉ {sunSign}&nbsp;&nbsp;☽ {moonSign}&nbsp;&nbsp;↑ {ascendant || "—"}
          </p>
        )}
      </div>

      <div style={{ height: "1px", background: "var(--border)", margin: "0 20px" }} />

      {/* Planet rows */}
      <div className="flex-1 overflow-y-auto py-2">
        {planets.map(p => {
          const key = p.planet.toLowerCase() as PlanetKey;
          const meta = PLANETS[key];
          const isActive = activePlanets.includes(key);
          return (
            <div key={p.planet} className={`flex items-center gap-3 px-5 ${isActive ? "planet-row-active" : ""}`}
              style={{
                height: "44px",
                borderBottom: "1px solid var(--border)",
                borderLeft: isActive ? undefined : "3px solid transparent",
                transition: "background 200ms, border-left 200ms",
                cursor: "default",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--cream-dark)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              {/* Planet symbol with colored circle bg */}
              <span style={{
                width: "30px", height: "30px", borderRadius: "8px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "18px",
                color: meta?.color ?? "var(--purple)",
                background: `${meta?.color ?? "var(--purple)"}15`,
                textShadow: isActive ? `0 0 10px ${meta?.color}` : "none",
                transition: "text-shadow 200ms",
                fontFamily: "'Space Mono', monospace",
                flexShrink: 0,
              }}>
                {meta?.symbol ?? "✦"}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", width: "58px", fontWeight: 500 }}>
                {meta?.name ?? p.planet}
              </span>
              <span className="font-serif" style={{ fontSize: "14px", color: "var(--text)", flex: 1, fontWeight: 500 }}>
                {p.sign}
              </span>
              <span className="font-mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {p.degree.toFixed(1)}°
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border)", fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Space Mono', monospace" }}>
        {today}
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--cream)" }}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col" style={{
        width: "290px", borderRight: "1px solid var(--border)", background: "var(--cream-light)", flexShrink: 0, height: "100vh", overflow: "hidden",
      }}>
        {sidebarContent}
      </aside>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden" style={{ background: "var(--cream)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5" style={{
          height: "56px", borderBottom: "1px solid var(--border)", background: "var(--cream-light)", flexShrink: 0,
        }}>
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setShowMobileSidebar(true)} style={{
              background: "none", border: "none", color: "var(--purple)", fontSize: "18px", cursor: "pointer", padding: "4px",
            }}>
              ☰
            </button>
            <span style={{ color: "var(--gold)", fontSize: "16px" }}>✦</span>
            <span className="font-serif" style={{ color: "var(--text)", fontSize: "17px", fontWeight: 600 }}>Astra</span>
          </div>
          <div className="md:hidden font-mono" style={{ fontSize: "11px", color: "var(--purple)" }}>
            {chartData && <>☉ {sunSign} · ☽ {moonSign?.slice(0, 3)}</>}
          </div>
        </div>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-5 max-w-3xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <span style={{ fontSize: "40px", color: "var(--gold)", opacity: 0.4 }}>✦</span>
                <p className="font-serif mt-3" style={{ fontSize: "18px", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Ask Astra about your chart...
                </p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <MessageBubble key={`${msg.timestamp}-${idx}`} message={msg}
                isLatestAssistant={msg.role === "assistant" && idx === lastAssistantIndex}
                showCursor={isTyping && msg.role === "assistant" && idx === lastAssistantIndex} />
            ))}
            {isLoading && !isTyping && <LoadingDots />}
            {error && (
              <div style={{ color: "var(--error)", borderLeft: "2px solid var(--error)", paddingLeft: "16px", fontSize: "13px" }}>
                {error}
              </div>
            )}
            <div ref={endRef} />
          </div>
        </main>

        {/* Stop / Input bar */}
        <div style={{ background: "var(--cream-light)", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          {/* Stop generating button */}
          {isLoading && (
            <div className="flex justify-center" style={{ paddingTop: "10px" }}>
              <button
                onClick={stopGeneration}
                style={{
                  display: "flex", alignItems: "center", gap: "7px",
                  background: "var(--card)", border: "1.5px solid var(--border)",
                  borderRadius: "20px", padding: "7px 18px",
                  fontSize: "13px", color: "var(--text-secondary)",
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500, transition: "border-color 150ms, background 150ms",
                  boxShadow: "var(--card-shadow)",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "var(--purple)";
                  e.currentTarget.style.color = "var(--purple)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <span style={{
                  width: "10px", height: "10px", borderRadius: "2px",
                  background: "currentColor", display: "inline-block", flexShrink: 0,
                }} />
                Stop generating
              </button>
            </div>
          )}
          {/* Input row */}
          <div className="flex items-center gap-3 px-5" style={{ height: "64px" }}>
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
              placeholder="Ask Astra..." disabled={isLoading}
              className="flex-1"
              style={{
                background: "var(--white)", border: "1.5px solid var(--border)", borderRadius: "12px",
                padding: "10px 16px", color: "var(--text)", fontSize: "14px",
                fontFamily: "'DM Sans', sans-serif", transition: "border-color 200ms",
              }}
            />
            <button type="button" onClick={handleSend} disabled={isLoading || !input.trim()}
              className="btn-gradient"
              style={{
                width: "40px", height: "40px", borderRadius: "10px", fontSize: "18px",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
              ↑
            </button>
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {showMobileSidebar && (
        <>
          <div className="bottom-sheet-overlay md:hidden" onClick={() => setShowMobileSidebar(false)} />
          <div className="bottom-sheet md:hidden flex flex-col">
            <div className="bottom-sheet-handle" />
            {sidebarContent}
          </div>
        </>
      )}
    </div>
  );
}
