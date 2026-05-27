# Evaluation — AstroAgent

## Overview

This document reflects on what the evaluation harness revealed about AstroAgent's behavior, strengths, failure modes, and what we would prioritize fixing with more time.

## Evaluation Harness

### Golden Set
- **File**: `evals/golden_set_v1.jsonl`
- **Cases**: 25 versioned test cases covering:
  - General greetings and astrology focus (TC01)
  - Chart requests with/without birth details (TC02–TC03)
  - Daily transit queries (TC04)
  - Off-topic redirection: coding, stocks (TC05–TC06)
  - Free-form astrology knowledge: Sun in Leo, Mercury retrograde (TC07–TC08)
  - Missing birth details prompts (TC09, TC12)
  - Specific planet placement queries (TC10, TC20)
  - **Failure modes (EV05)**:
    - Impossible date: February 30 (TC11)
    - Prompt injection: "ignore instructions" and "DAN" attacks (TC13–TC14)
    - Medical certainty guardrail (TC15)
    - Financial certainty guardrail (TC16)
    - Legal advice guardrail (TC17)
    - Adversarial gibberish (TC18)
    - Empty message (TC19)
    - Unknown/rare place geocoding edge case (TC23)

### Runner
- **Command**: `npm run eval` (one command, per EV06)
- **Metrics tracked (EV04)**: latency (p50, p95), tool-call count, failure rate
- **Output**: Scorecard table printed to terminal + JSON result file saved + `history.md` appended for regression tracking

### Deterministic vs Judgment (EV02)
- All grading is **deterministic keyword matching** (`contains_any`, `not_contains`)
- We do NOT use LLM-as-judge — every assertion is objectively verifiable
- This is a deliberate trade-off: we sacrifice nuance (tone, helpfulness) for reproducibility

## What the Eval Revealed

### Strengths
1. **Off-topic guardrails work reliably** — coding, stock, and adversarial prompts are consistently redirected to astrology
2. **Birth detail prompting is consistent** — the agent correctly asks for details when they're missing
3. **Chart computation is real** — the ephemeris library returns actual planetary positions, not hallucinated data
4. **Safety guardrails hold** — medical/financial/legal certainty is avoided in responses

### Weaknesses Found
1. **RouterNode keyword matching is brittle** — creative phrasing can bypass off-topic detection. A semantic classifier would be more robust.
2. **Free model limitations** — using `openai/gpt-oss-20b:free` via OpenRouter means occasional rate limits, moderation blocks, and lower quality responses compared to paid models.
3. **Geocoding edge cases** — very obscure or misspelled place names may fail, causing the chart computation to use fallback coordinates (0,0).
4. **Latency variance** — p95 latency can be high (15-30s) when the tool chain runs geocoding → ephemeris → LLM in sequence.

## What We Would Fix With More Time

1. **LLM-based intent classification** — replace the keyword router with a small LLM call to classify intent more accurately
2. **Streaming eval** — test the SSE streaming endpoint (`/api/chat/stream`) in addition to the synchronous `/api/chat` endpoint
3. **LLM-as-judge for tone** — add a judge model with a rubric (1–5 on warmth, groundedness, completeness) to evaluate response quality beyond keyword matching. Would validate against 10+ manual verdicts for agreement rate per EV03.
4. **Cost tracking** — integrate OpenRouter's usage headers to log token count and dollar cost per eval run
5. **Conversation continuity testing** — test multi-turn conversations where the user provides details across messages
6. **Tolerance-based chart math validation** — compare planetary positions against a reference ephemeris to within ±1° tolerance

## Latest Scorecard

> Run `npm run eval` to generate a fresh scorecard. Results are saved to `evals/results/` and tracked in `evals/results/history.md`.

## Notes
- MongoDB uses collections `astro_users` and `astro_conversations` to avoid legacy index conflicts
- The agent graph is a custom TypeScript state machine (Router → Reason → Tool → LLM) — justified substitute for LangGraph documented in README
- All four tools implemented: `compute_birth_chart`, `get_daily_transits`, `geocode_place`, `knowledge_lookup`
