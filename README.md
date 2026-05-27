# AstroAgent 🔭

An AI-powered astrology companion that computes real birth charts, pulls live planetary transits, and streams conversational interpretations via a React frontend.

---

## Architecture Overview

```
User → React Frontend (Vite + TypeScript)
           │
           │  POST /api/chat/stream  (SSE)
           ▼
     Express Backend (TypeScript)
           │
           ▼
     Agent Graph (4-node state machine)
      ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
      │  Router  │ →  │  Reason  │ →  │   Tool   │ →  │   LLM    │
      │   Node   │    │   Node   │    │   Node   │    │  (stream)│
      └──────────┘    └──────────┘    └──────────┘    └──────────┘
           │                                │
           │                                ├── compute_birth_chart (ephemeris npm)
           │                                ├── get_daily_transits
           │                                ├── knowledge_lookup
           │                                └── geocodePlace (nominatim)
           ▼
      MongoDB (conversation history, user birth details, cached chart data)
```

### Graph Node Descriptions

| Node | Responsibility |
|------|---------------|
| **RouterNode** | Classifies intent from the last user message: `chart_request`, `daily_transit`, `free_form`, or `off_topic` using keyword matching |
| **ReasonNode** | Maps intent → tool selection or short-circuits with a canned reply (missing birth details, off-topic guard) |
| **ToolNode** | Executes the selected tool: geocoding → ephemeris computation → structured `ChartData` |
| **LLM Node** | Calls the LLM (via OpenRouter) with ephemeris context injected into the system prompt, streams tokens back |

---

## Agent Graph Framework — Justified Substitute

This project uses a **custom deterministic state-machine graph** rather than LangGraph. Justification:

1. **Fixed, known topology** — the graph always traverses Router → Reason → Tool → LLM in a single pass with no cycles or dynamic branching that LangGraph's conditional edges would add value for.
2. **Full TypeScript safety** — the `AgentState` interface provides compile-time guarantees across every node; LangGraph's JS SDK adds significant boilerplate without benefit here.
3. **Zero Python dependency** — the entire stack is Node.js/TypeScript; LangGraph's primary implementation is Python, and the JS SDK is still maturing.
4. **Transparent & auditable** — `runAgent` in `graph.ts` is ~20 lines and trivially readable; adding a framework for a 4-node linear graph would obscure rather than clarify.

If the graph grows to include cycles, parallel branches, or human-in-the-loop nodes, migrating to `@langchain/langgraph` would be appropriate.

---

## Setup

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)
- An [OpenRouter](https://openrouter.ai) API key

### Backend

```bash
cd backend
cp .env.example .env   # fill in OPENROUTER_API_KEY, MONGODB_URI, MODEL
npm install
npm run dev            # starts on http://localhost:8000
```

**Required `.env` keys:**
```
OPENROUTER_API_KEY=sk-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
MONGODB_URI=mongodb://localhost:27017/astroagent
MODEL=google/gemini-2.0-flash-001
PORT=8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:5173
```

---

## Streaming

Chat responses are streamed via **Server-Sent Events** on `POST /api/chat/stream`.

- The graph executes Router → Reason → Tool nodes synchronously.
- The LLM call uses `stream: true`; each token is forwarded as `data: {"token":"…"}`.
- Tool activity is signalled as `data: {"tool_activity":"compute_birth_chart"}`.
- Completion arrives as `data: {"done":true,"intent":"…","chartData":{…}}`.

The React frontend uses `fetch` + `ReadableStream` to consume tokens and appends them directly to message state — no polling or simulated typing.

---

## Evaluation Harness

```bash
cd backend
npm run eval           # run all 25 golden-set cases (exit 0 = all pass)
npm run eval:verbose   # same, with full LLM replies printed
npm run eval -- --id TC05   # run a single case
```

- Golden set: [`evals/golden_set_v1.jsonl`](./backend/evals/golden_set_v1.jsonl) — versioned, 25 cases covering greetings, chart requests, transits, off-topic guards, free-form astrology, **failure modes** (impossible dates, prompt injection, medical/financial/legal guardrails, adversarial gibberish, empty messages).
- **Metrics per EV04**: latency (p50, p95), tool-call count, failure rate — printed as a scorecard table.
- **History tracking per EV06**: each run appends to `evals/results/history.md` for regression visibility.
- Results are saved to `evals/results/run_eval_<timestamp>.json`.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Non-streaming chat (JSON response) |
| `POST` | `/api/chat/stream` | **Streaming chat (SSE)** |
| `POST` | `/api/birth-chart` | Direct ephemeris computation |
| `POST` | `/api/user/birth-details` | Save birth details |
| `GET`  | `/api/user/:userId` | Fetch stored user data |
| `GET`  | `/api/conversation/:userId` | Fetch conversation history |

---

## Known Limitations

- **RouterNode is keyword-based** — ambiguous or creative phrasing may mis-classify intent. A future improvement would use an LLM call for classification.
- **Geocoding depends on Nominatim** — rate-limited; obscure place names may fail to resolve.
- **Single conversation per userId** — no multi-session support; the entire history is loaded on each request.
- **Off-topic keyword list is brittle** — prompt injection via paraphrasing may bypass the guard. A semantic classifier would be more robust.
- **No auth** — userId is a client-generated UUID; there's no session verification.

---

## Project Structure

```
AstroAgent/
├── backend/
│   ├── src/
│   │   ├── agent/
│   │   │   ├── graph.ts          # runAgent + runAgentStream
│   │   │   ├── state.ts          # AgentState type
│   │   │   ├── nodes/            # routerNode, reasonNode
│   │   │   └── tools/            # birthChart, dailyTransits, geocodePlace, knowledgeLookup
│   │   ├── controllers/          # astro.controller.ts (chat, stream, user, conversation)
│   │   ├── routes/               # astro.ts
│   │   ├── models/               # User.ts, Conversation.ts
│   │   └── config/               # config.ts
│   ├── evals/
│   │   ├── golden_set_v1.jsonl   # versioned test cases
│   │   └── results/              # auto-generated run results
│   ├── scripts/
│   │   └── run_eval.ts           # one-command eval runner
│   └── EVALUATION.md             # latest scorecard
└── frontend/
    └── src/
        ├── components/           # MessageBubble (user/assistant/tool roles)
        ├── hooks/                # useChat (real SSE streaming)
        ├── services/             # api.ts (sendMessageStream)
        └── context/              # AstroContext
```
