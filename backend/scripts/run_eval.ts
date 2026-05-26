/**
 * AstroAgent Evaluation Runner (EV01)
 * ------------------------------------
 * Runs every case from evals/golden_set_v1.jsonl against the live API.
 *
 * Usage:
 *   npm run eval                   — run all cases
 *   npm run eval -- --id TC05      — run a single case by ID
 *   npm run eval -- --verbose      — print full LLM replies
 *
 * Exit code 0 = all pass, 1 = one or more failures.
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
const TIMEOUT_MS = 30_000;

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
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function loadCases(): EvalCase[] {
  const raw = fs.readFileSync(GOLDEN_SET, "utf-8");
  return raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as EvalCase);
}

async function callChat(input: EvalCase["input"]): Promise<string> {
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

    const data = (await res.json()) as { reply?: string };
    return data.reply ?? "";
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
    process.stdout.write(`  ${tc.id.padEnd(6)} ${tc.description.padEnd(55)} `);
    const t0 = Date.now();

    try {
      const reply = await callChat(tc.input);
      const failures = grade(tc, reply);
      const status = failures.length === 0 ? "pass" : "fail";
      const durationMs = Date.now() - t0;

      results.push({ id: tc.id, version: tc.version, description: tc.description, status, reply, failures, durationMs });

      if (status === "pass") {
        console.log(color("PASS", 32) + ` (${durationMs}ms)`);
      } else {
        console.log(color("FAIL", 31) + ` (${durationMs}ms)`);
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
        status: "fail", reply: "", failures: [`Exception: ${msg}`], durationMs,
      });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.length - passed;

  console.log(`\n${"─".repeat(70)}`);
  console.log(`  Total: ${results.length}  ${color(`Passed: ${passed}`, 32)}  ${failed > 0 ? color(`Failed: ${failed}`, 31) : `Failed: ${failed}`}`);
  console.log(`${"─".repeat(70)}\n`);

  // ── Write versioned results file ────────────────────────────────────────────
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const runId = `run_eval_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const outPath = path.join(RESULTS_DIR, `${runId}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ runId, timestamp: new Date().toISOString(), passed, failed, results }, null, 2));
  console.log(`  Results saved → ${outPath}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Eval runner crashed:", err);
  process.exit(1);
});
