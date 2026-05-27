import { useMemo } from "react";
import type { Message } from "../context/AstroContext";

type MessageBubbleProps = {
  message: Message;
  isLatestAssistant?: boolean;
  showCursor?: boolean;
};

/* ── Planet symbol map ── */
const PLANET_SYMBOLS: Record<string, { symbol: string; color: string }> = {
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
  chiron:  { symbol: "⚷", color: "#8B7355" },
};

const SIGN_SYMBOLS: Record<string, string> = {
  aries: "♈", taurus: "♉", gemini: "♊", cancer: "♋",
  leo: "♌", virgo: "♍", libra: "♎", scorpio: "♏",
  sagittarius: "♐", capricorn: "♑", aquarius: "♒", pisces: "♓",
};

/* ── Detect if a line is part of a markdown table ── */
const isTableRow = (line: string) => line.trim().startsWith("|");
const isSeparatorRow = (line: string) => /^\|[\s\-:|]+$/.test(line.trim());

/* ── Render a markdown table block ── */
function renderTable(tableLines: string[]): React.ReactNode {
  // Filter out separator rows
  const dataRows = tableLines.filter(l => !isSeparatorRow(l));
  if (dataRows.length === 0) return null;

  const parseRow = (line: string) => {
    const rawParts = line.split("|");
    // The first element is always empty because the line starts with '|'
    const parts = rawParts.slice(1);
    // If the last element is empty (because the line ends with '|'), drop it
    if (parts.length > 0 && parts[parts.length - 1].trim() === "") {
      parts.pop();
    }
    return parts.map(c => c.trim());
  };

  const headerCells = parseRow(dataRows[0]);
  const bodyRows = dataRows.slice(1).map(line => {
    const cells = parseRow(line);
    // Pad cells to match header length for stable streaming alignment
    while (cells.length < headerCells.length) {
      cells.push("");
    }
    return cells;
  });

  return (
    <div style={{ overflowX: "auto", margin: "8px 0" }}>
      <table style={{
        width: "100%",
        minWidth: "100%",
        tableLayout: "fixed",
        borderCollapse: "collapse",
        fontSize: "13px",
        fontFamily: "'Space Mono', monospace",
      }}>
        <colgroup>
          {headerCells.map((_, i) => (
            <col key={`col-${i}`} style={{ width: `${100 / headerCells.length}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {headerCells.map((cell, i) => (
              <th key={i} style={{
                padding: "8px 12px",
                textAlign: "left",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--purple)",
                fontWeight: 600,
                borderBottom: "2px solid var(--purple-border)",
                whiteSpace: "nowrap",
              }}>
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: "1px solid var(--border)" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: "7px 12px",
                  color: ci === 0 ? "var(--text)" : "var(--text-secondary)",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  verticalAlign: "top",
                }}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main markdown → JSX renderer ── */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line → spacer
    if (!trimmed) {
      elements.push(<div key={`br-${i}`} style={{ height: "6px" }} />);
      i++;
      continue;
    }

    // Table block: collect consecutive table rows
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<div key={`tbl-${i}`}>{renderTable(tableLines)}</div>);
      continue;
    }

    // List item (- or *)
    const listMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      elements.push(
        <div key={`li-${i}`} style={{
          display: "flex", gap: "10px", paddingLeft: "4px", marginBottom: "6px",
          alignItems: "flex-start",
        }}>
          <span style={{ color: "var(--purple)", flexShrink: 0, marginTop: "2px", fontSize: "8px" }}>●</span>
          <span>{renderInline(listMatch[1])}</span>
        </div>
      );
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <div key={`p-${i}`} style={{ marginBottom: "4px" }}>
        {renderInline(trimmed)}
      </div>
    );
    i++;
  }

  return elements;
}

/* ── Inline formatting: **bold**, planet names → symbols, sign names → symbols ── */
function renderInline(text: string): React.ReactNode[] {
  // Step 1: Split by **bold** patterns
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...injectSymbols(text.slice(lastIndex, match.index), `pre-${match.index}`));
    }
    parts.push(
      <strong key={`b-${match.index}`} style={{ fontWeight: 600, color: "var(--text)" }}>
        {injectSymbols(match[1], `bs-${match.index}`)}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(...injectSymbols(text.slice(lastIndex), `end-${lastIndex}`));
  }

  return parts;
}

/* ── Inject planet & sign symbols into plain text ── */
function injectSymbols(text: string, keyPrefix: string): React.ReactNode[] {
  // Build a combined regex for planet and sign names
  const planetNames = Object.keys(PLANET_SYMBOLS);
  const signNames = Object.keys(SIGN_SYMBOLS);
  const allNames = [...planetNames, ...signNames];
  const pattern = new RegExp(`\\b(${allNames.join("|")})\\b`, "gi");

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    // Text before match
    if (m.index > lastIdx) {
      parts.push(text.slice(lastIdx, m.index));
    }

    const name = m[1];
    const lower = name.toLowerCase();
    const planet = PLANET_SYMBOLS[lower];
    const sign = SIGN_SYMBOLS[lower];

    if (planet) {
      parts.push(
        <span key={`${keyPrefix}-p-${m.index}`} style={{
          color: planet.color,
          fontWeight: 600,
        }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "18px",
            height: "18px",
            borderRadius: "4px",
            background: `${planet.color}18`,
            fontSize: "13px",
            marginRight: "3px",
            verticalAlign: "middle",
            lineHeight: 1,
          }}>
            {planet.symbol}
          </span>
          {name}
        </span>
      );
    } else if (sign) {
      parts.push(
        <span key={`${keyPrefix}-s-${m.index}`} style={{ color: "var(--purple)", fontWeight: 500 }}>
          {sign} {name}
        </span>
      );
    }

    lastIdx = pattern.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
}

/* ── Component ── */
export default function MessageBubble({ message, isLatestAssistant, showCursor }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  const renderedContent = useMemo(() => renderMarkdown(message.content), [message.content]);

  // ── Tool activity card ──
  if (isTool) {
    const TOOL_META: Record<string, { label: string; accent: string; icon: string; description: string }> = {
      compute_birth_chart: {
        label: "Computing birth chart…",
        accent: "#D4A021",
        icon: "☉",
        description: "Astra is using compute_birth_chart to keep the reading grounded in real data.",
      },
      get_daily_transits: {
        label: "Fetching today's transits…",
        accent: "#5B9EA6",
        icon: "♃",
        description: "Astra is using get_daily_transits to check the current sky for today.",
      },
      geocode_place: {
        label: "Resolving birth location…",
        accent: "#7C5CBA",
        icon: "⌖",
        description: "Astra is using geocode_place to resolve coordinates and time-zone details.",
      },
      knowledge_lookup: {
        label: "Looking up astrology knowledge…",
        accent: "#C47A9E",
        icon: "✦",
        description: "Astra is using knowledge_lookup to ground the interpretation in reference notes.",
      },
    };
    const rawToolName = message.content;
    const meta =
      rawToolName === "__TOOL_PENDING__"
        ? {
            label: "Preparing tool call…",
            accent: "#8B7EB8",
            icon: "⟳",
            description: "Astra is preparing to run a tool. This may be computing a chart or resolving your location.",
          }
        : TOOL_META[rawToolName] ?? {
            label: `Running ${message.content}…`,
            accent: "#8B7EB8",
            icon: "⚙",
            description: `Astra is using ${rawToolName} to keep the reading grounded in real data.`,
          };

    return (
      <div className="flex justify-start">
        <div style={{ maxWidth: "82%" }}>
          <div style={{
            fontSize: "10px",
            color: "var(--gold)",
            letterSpacing: "0.2em",
            fontWeight: 600,
            marginBottom: "6px",
          }}>
            ✦ ASTRA
          </div>
          <div style={{
            borderLeft: "2px solid var(--purple-border)",
            paddingLeft: "16px",
            color: "var(--text-secondary)",
            fontSize: "14px",
            lineHeight: "1.75",
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 14px",
              borderRadius: "999px",
              background: `${meta.accent}14`,
              border: `1px solid ${meta.accent}40`,
              fontSize: "12px",
              color: meta.accent,
              fontFamily: "'Space Mono', monospace",
              letterSpacing: "0.04em",
              marginBottom: "8px",
              boxShadow: `0 0 0 1px ${meta.accent}08 inset`,
            }}>
              <span style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: `${meta.accent}20`,
                border: `1px solid ${meta.accent}40`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "pulse 1.2s ease-in-out infinite",
                flexShrink: 0,
              }} />
              <span style={{
                position: "absolute",
                width: "22px",
                height: "22px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                lineHeight: 1,
              }}>
                {meta.icon}
              </span>
              <span>TOOL CALL</span>
              <span style={{ opacity: 0.9 }}>•</span>
              <span>{meta.label}</span>
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {meta.description} <strong style={{ color: "var(--text)" }}>{rawToolName}</strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div style={{
          maxWidth: "75%",
          padding: "12px 18px",
          fontSize: "14px",
          lineHeight: "1.65",
          background: "var(--gradient-btn)",
          color: "#fff",
          borderRadius: "16px 16px 4px 16px",
          boxShadow: "0 2px 12px rgba(242, 140, 56, 0.2)",
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start" data-latest-assistant={isLatestAssistant ? "true" : "false"}>
      <div style={{ maxWidth: "82%" }}>
        <div style={{
          fontSize: "10px",
          color: "var(--gold)",
          letterSpacing: "0.2em",
          fontWeight: 600,
          marginBottom: "6px",
        }}>
          ✦ ASTRA
        </div>
        <div style={{
          borderLeft: "2px solid var(--purple-border)",
          paddingLeft: "16px",
          color: "var(--text-secondary)",
          fontSize: "14px",
          lineHeight: "1.75",
        }}>
          {renderedContent}
          {showCursor && <span className="typing-cursor">|</span>}
        </div>
      </div>
    </div>
  );
}

