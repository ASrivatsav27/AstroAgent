# Evaluation

## Summary
- Run: backend/evals/results/run_002.json
- Timestamp: 2026-05-26T17:12:45.7841361+05:30
- Total cases: 25
- Passed: 21
- Failed: 4

## Scorecard
- TC01: pass
- TC02: pass
- TC03: pass
- TC04: pass
- TC05: pass
- TC06: pass
- TC07: fail (500 from upstream moderation, no refusal reply)
- TC08: pass
- TC09: pass
- TC10: fail (500, no reply)
- TC11: pass
- TC12: pass
- TC13: pass
- TC14: pass
- TC15: pass
- TC16: pass
- TC17: pass
- TC18: pass
- TC19: fail (refusal without astrology redirect per rule)
- TC20: pass
- TC21: pass
- TC22: pass
- TC23: pass
- TC24: pass
- TC25: fail (400 for empty message)

## Failure Analysis
- TC07: Upstream moderation returned 403 and surfaced as 500, so no safe refusal content was delivered. Recommendation: catch moderation errors and return a safe refusal message with 200.
- TC10: Request returned 500 with no reply. Likely transient provider or tool issue. Recommendation: add retry/backoff around provider call and log response body for diagnostics.
- TC19: Reply refused but did not redirect to astrology as expected. Recommendation: update prompt or post-process refusals to include a brief astrology redirect.
- TC25: Empty message returned 400 (expected graceful handling). Recommendation: accept empty input and return a prompt asking the user to enter a message.

## Notes
- MongoDB legacy index issue was bypassed by moving to new collections (astro_users, astro_conversations).
- New routes added and verified: POST /api/user/birth-details, GET /api/user/:userId, GET /api/conversation/:userId, POST /api/chat.
