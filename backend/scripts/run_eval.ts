/**
 * AstroAgent Evaluation Runner (EV01–EV06)
 * ------------------------------------------
 * Runs every case from evals/golden_set_v1.jsonl against the live API.
 *
 * Usage:
 *   npm run eval                   — run all cases
 *   npm run eval -- --id TC05      — run a single case by ID
 *   npm run eval -- --verbose      — print full LLM replies
 *
 * Exit code 0 = all pass, 1 = one or more failures.
 *
 * Metrics tracked per EV04: latency (p50, p95), failure rate, tool-call count.
 * Scorecard table printed per EV06. History appended to evals/results/history.md.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = process.env.API_BASE ?? "http://localhost:8000/api";
const GOLDEN_SET = path.join(__dirname, "../evals/golden_set_v1.jsonl");
const RESULTS_DIR = path.join(__dirname, "../evals/results");
const HISTORY_FILE = path.join(RESULTS_DIR, "history.md");
const TIMEOUT_MS = 60_000;

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const filterId = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;
const verbose = args.includes("--verbose");

// ── Types ────────────────────────────────────────────────────────────────────
interface EvalCase {
  id: string;
  version: string;
  description: string;
  input: {
    message: string;
    birthDetails?: object;
  };
  expect: {
    no_error: boolean;
    contains_any?: string[];
    not_contains?: string[];
  };
}

interface EvalResult {
  id: string;
  version: string;
  description: string;
  status: "pass" | "fail";
  reply: string;
  failures: string[];
  durationMs: number;
  toolCalls: number;
  intent: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function loadCases(): EvalCase[] {
  const raw = fs.readFileSync(GOLDEN_SET, "utf-8");
  return raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as EvalCase);
}

interface ChatResponse {
  reply: string;
  intent: string | null;
  chartData: unknown;
  messages: { role: string; content: string; toolCall?: string }[];
}

async function callChat(input: EvalCase["input"]): Promise<ChatResponse> {
  const userId = `eval-${crypto.randomUUID()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...input }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body}`);
    }

    const data = await res.json() as ChatResponse;
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function grade(tc: EvalCase, reply: string): string[] {
  const failures: string[] = [];
  const lower = reply.toLowerCase();

  if (tc.expect.contains_any) {
    const hit = tc.expect.contains_any.some((kw) => lower.includes(kw.toLowerCase()));
    if (!hit) {
      failures.push(`Expected reply to contain one of [${tc.expect.contains_any.join(", ")}]`);
    }
  }

  if (tc.expect.not_contains) {
    for (const kw of tc.expect.not_contains) {
      if (lower.includes(kw.toLowerCase())) {
        failures.push(`Reply must NOT contain "${kw}"`);
      }
    }
  }

  return failures;
}

function color(text: string, code: number) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const cases = loadCases().filter((tc) => !filterId || tc.id === filterId);

  if (cases.length === 0) {
    console.error(`No cases found${filterId ? ` for id="${filterId}"` : ""}.`);
    process.exit(1);
  }

  console.log(`\n🔭 AstroAgent Eval — ${cases.length} case(s) against ${API_BASE}\n`);

  const results: EvalResult[] = [];

  for (const tc of cases) {
    process.stdout.write(`  ${tc.id.padEnd(6)} ${tc.description.padEnd(60)} `);
    const t0 = Date.now();

    try {
      const response = await callChat(tc.input);
      const reply = response.reply ?? "";
      const failures = grade(tc, reply);
      const status = failures.length === 0 ? "pass" : "fail";
      const durationMs = Date.now() - t0;

      // Count tool calls from messages
      const toolCalls = (response.messages ?? []).filter(
        (m) => m.role === "tool" || m.toolCall
      ).length;

      results.push({
        id: tc.id, version: tc.version, description: tc.description,
        status, reply, failures, durationMs, toolCalls, intent: response.intent,
      });

      if (status === "pass") {
        console.log(color("PASS", 32) + ` (${durationMs}ms, tools:${toolCalls})`);
      } else {
        console.log(color("FAIL", 31) + ` (${durationMs}ms, tools:${toolCalls})`);
        for (const f of failures) console.log(`         ↳ ${f}`);
      }

      if (verbose) {
        console.log(`         Reply: ${reply.slice(0, 200)}${reply.length > 200 ? "…" : ""}\n`);
      }
    } catch (err: any) {
      const durationMs = Date.now() - t0;
      const msg = err?.message ?? String(err);
      console.log(color("ERROR", 33) + ` (${durationMs}ms) — ${msg}`);
      results.push({
        id: tc.id, version: tc.version, description: tc.description,
        status: "fail", reply: "", failures: [`Exception: ${msg}`],
        durationMs, toolCalls: 0, intent: null,
      });
    }
  }

  // ── Metrics ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.length - passed;
  const failureRate = ((failed / results.length) * 100).toFixed(1);
  const latencies = results.map((r) => r.durationMs);
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const totalToolCalls = results.reduce((acc, r) => acc + r.toolCalls, 0);
  const avgToolCalls = (totalToolCalls / results.length).toFixed(1);

  // ── Scorecard Table (EV06) ────────────────────────────────────────────────
  console.log(`\n${"═".repeat(78)}`);
  console.log(`  📊 SCORECARD`);
  console.log(`${"═".repeat(78)}`);
  console.log(`  ${"ID".padEnd(6)} ${"Description".padEnd(45)} ${"Status".padEnd(8)} ${"Latency".padEnd(10)} Tools`);
  console.log(`  ${"─".repeat(74)}`);
  for (const r of results) {
    const statusStr = r.status === "pass" ? color("PASS", 32) : color("FAIL", 31);
    console.log(`  ${r.id.padEnd(6)} ${r.description.slice(0, 43).padEnd(45)} ${statusStr.padEnd(19)} ${(r.durationMs + "ms").padEnd(10)} ${r.toolCalls}`);
  }
  console.log(`  ${"─".repeat(74)}`);
  console.log(`  Total: ${results.length}  |  ${color(`Passed: ${passed}`, 32)}  |  ${failed > 0 ? color(`Failed: ${failed}`, 31) : `Failed: ${failed}`}  |  Failure rate: ${failureRate}%`);
  console.log(`  Latency  p50: ${p50}ms  p95: ${p95}ms  |  Avg tool calls: ${avgToolCalls}`);
  console.log(`${"═".repeat(78)}\n`);

  // ── Write versioned results file ────────────────────────────────────────────
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString();
  const runId = `run_eval_${timestamp.replace(/[:.]/g, "-")}`;
  const outPath = path.join(RESULTS_DIR, `${runId}.json`);

  const summary = {
    runId,
    timestamp,
    totalCases: results.length,
    passed,
    failed,
    failureRate: `${failureRate}%`,
    latencyP50Ms: p50,
    latencyP95Ms: p95,
    totalToolCalls,
    avgToolCalls: parseFloat(avgToolCalls),
    results,
  };

  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`  Results saved → ${outPath}`);

  // ── Append to history.md (EV06 — track over time) ──────────────────────────
  const historyLine = `| ${timestamp.slice(0, 19)} | ${results.length} | ${passed} | ${failed} | ${failureRate}% | ${p50}ms | ${p95}ms | ${avgToolCalls} |`;
  if (!fs.existsSync(HISTORY_FILE)) {
    const header = `# Eval History\n\n| Timestamp | Cases | Passed | Failed | Fail% | p50 | p95 | Avg Tools |\n|-----------|-------|--------|--------|-------|-----|-----|-----------|\n`;
    fs.writeFileSync(HISTORY_FILE, header + historyLine + "\n");
  } else {
    fs.appendFileSync(HISTORY_FILE, historyLine + "\n");
  }
  console.log(`  History appended → ${HISTORY_FILE}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Eval runner crashed:", err);
  process.exit(1);
});
