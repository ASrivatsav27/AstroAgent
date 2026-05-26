import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAstro, type ChartData } from "../context/AstroContext";
import { computeBirthChart } from "../services/api";

const PLANET_META: Record<string, { symbol: string; color: string }> = {
  sun:     { symbol: "☉", color: "#D4A021" },
  moon:    { symbol: "☽", color: "#8B7EB8" },
  mercury: { symbol: "☿", color: "#5BA37E" },
  venus:   { symbol: "♀", color: "#C47A9E" },
  mars:    { symbol: "♂", color: "#C05D5D" },
  jupiter: { symbol: "♃", color: "#C4A265" },
  saturn:  { symbol: "♄", color: "#8B7355" },
  uranus:  { symbol: "♅", color: "#5B9EA6" },
  neptune: { symbol: "♆", color: "#7C5CBA" },
  pluto:   { symbol: "♇", color: "#9B6FB0" },
};

const SIGN_ELEMENT: Record<string, string> = {
  Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
  Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
  Gemini: "Air", Libra: "Air", Aquarius: "Air",
  Cancer: "Water", Scorpio: "Water", Pisces: "Water",
};

const ELEMENT_COLORS: Record<string, string> = {
  Fire: "#C05D5D", Earth: "#8B7355", Air: "#7C5CBA", Water: "#5B9EA6",
};

type CosmicRevealProps = { onComplete: () => void };

export default function CosmicReveal({ onComplete }: CosmicRevealProps) {
  const { birthDetails, chartData, setChartData } = useAstro();
  const navigate = useNavigate();
  const [localChart, setLocalChart] = useState<ChartData | null>(chartData);
  const [ready, setReady] = useState(!!chartData);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (chartData) { setLocalChart(chartData); setReady(true); return; }
    if (!birthDetails) { setReady(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const chart = await computeBirthChart(birthDetails);
        if (cancelled) return;
        if (chart) { setChartData(chart); setLocalChart(chart); }
        setReady(true);
      } catch (err: any) {
        if (!cancelled) {
          setFetchError(err?.message ?? "Failed to compute birth chart");
          setReady(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [birthDetails, chartData, setChartData]);

  const planets = localChart?.planets ?? [];
  const ascendant = localChart?.ascendant ?? "";
  const sunSign = useMemo(() => planets.find(p => p.planet.toLowerCase() === "sun")?.sign ?? "", [planets]);
  const moonSign = useMemo(() => planets.find(p => p.planet.toLowerCase() === "moon")?.sign ?? "", [planets]);

  const formattedBirth = useMemo(() => {
    if (!birthDetails) return "";
    return [birthDetails.place, birthDetails.date, birthDetails.time].filter(Boolean).join(" · ");
  }, [birthDetails]);

  const elementCounts = useMemo(() => {
    const c: Record<string, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
    planets.forEach(p => { const el = SIGN_ELEMENT[p.sign]; if (el) c[el] += 1; });
    return c;
  }, [planets]);

  const handleEnter = useCallback(() => { onComplete(); navigate("/chat"); }, [navigate, onComplete]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center constellation-bg" style={{ background: "var(--cream)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
          </div>
          <p className="font-serif" style={{ fontSize: "16px", color: "var(--purple)", fontStyle: "italic" }}>
            Reading the stars for you...
          </p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center constellation-bg" style={{ background: "var(--cream)" }}>
        <div className="flex flex-col items-center gap-4 text-center px-5" style={{ maxWidth: "400px" }}>
          <span style={{ fontSize: "32px", color: "var(--gold)" }}>✦</span>
          <p className="font-serif" style={{ fontSize: "18px", color: "var(--text)" }}>Something went wrong</p>
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>{fetchError}</p>
          <button onClick={handleEnter} className="btn-gradient" style={{ padding: "12px 28px", borderRadius: "10px", fontSize: "14px" }}>
            Continue to Chat Anyway →
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12 constellation-bg fade-in-mount" style={{ background: "var(--cream)" }}>
      <div className="w-full" style={{ maxWidth: "640px" }}>
        {/* Header */}
        <div className="text-center mb-10">
          <p style={{ fontSize: "11px", color: "var(--gold)", letterSpacing: "0.3em", marginBottom: "12px", fontWeight: 500 }}>
            ✦ YOUR COSMIC BLUEPRINT ✦
          </p>
          <p className="font-mono" style={{ fontSize: "15px", color: "var(--text-secondary)", marginBottom: "8px" }}>
            {formattedBirth}
          </p>
          <div className="flex items-center justify-center gap-5 mt-4">
            <span className="font-serif" style={{ fontSize: "20px", color: "var(--purple)", fontWeight: 500 }}>
              ☉ {sunSign || "—"}
            </span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span className="font-serif" style={{ fontSize: "20px", color: "var(--purple)", fontWeight: 500 }}>
              ☽ {moonSign || "—"}
            </span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span className="font-serif" style={{ fontSize: "20px", color: "var(--purple)", fontWeight: 500 }}>
              ↑ {ascendant || "—"}
            </span>
          </div>
        </div>

        {/* Planet Grid */}
        <div className="grid gap-3 mb-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {planets.map(p => {
            const meta = PLANET_META[p.planet.toLowerCase()];
            return (
              <div key={p.planet} style={{
                background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: "14px",
                padding: "18px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                boxShadow: "var(--card-shadow)", transition: "border-color 200ms, box-shadow 200ms", cursor: "default",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = meta?.color ?? "var(--purple)"; e.currentTarget.style.boxShadow = "var(--card-shadow-hover)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "var(--card-shadow)"; }}
              >
                <span style={{ fontSize: "30px", color: meta?.color ?? "var(--purple)", fontFamily: "'Space Mono', monospace" }}>
                  {meta?.symbol ?? "✦"}
                </span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 500 }}>
                  {p.planet}
                </span>
                <span className="font-serif" style={{ fontSize: "16px", color: "var(--text)", fontWeight: 500 }}>
                  {p.sign}
                </span>
                <span className="font-mono" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {p.degree.toFixed(1)}°
                </span>
              </div>
            );
          })}
        </div>

        {/* Element breakdown */}
        <div className="flex gap-2 mb-10 flex-wrap justify-center">
          {Object.entries(elementCounts).map(([elem, count]) => (
            <span key={elem} style={{
              background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: "10px",
              padding: "8px 16px", fontSize: "13px", color: "var(--text-secondary)",
              boxShadow: "var(--card-shadow)",
            }}>
              <span style={{ color: ELEMENT_COLORS[elem] }}>●</span> {elem}:{" "}
              <strong style={{ color: "var(--purple)" }}>{count}</strong>
            </span>
          ))}
        </div>

        {/* CTA */}
        <button onClick={handleEnter} className="btn-gradient w-full" style={{ height: "52px", fontSize: "16px", borderRadius: "14px" }}>
          Enter Your Reading →
        </button>
      </div>
    </div>
  );
}
