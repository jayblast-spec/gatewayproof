# gatewayproof

**A conformance test suite for OpenAI-compatible LLM gateways — catches streaming, usage, cost, concurrency, and error-handling bugs that an eyeball review of a diff won't.**

## The gap this fills

LLM gateways ([LiteLLM](https://github.com/BerriAI/litellm), and its many peers) sit in the hot path of every request an agent makes: they re-stream responses, recompute usage, and calculate cost on every call. That's exactly the kind of code that's easy to get subtly wrong — a dropped SSE chunk, a cost miscalculation, a race between concurrent streams, an upstream failure silently reported as a clean `finish_reason: "stop"`. These bugs don't show up in a quick manual test; they show up in production, under load, as a wrong bill or a truncated response nobody notices until a user complains.

There was no independent, reusable conformance suite for this — every gateway project hand-rolls its own tests against its own assumptions about what "correct" means. gatewayproof is that suite: a deterministic mock upstream with known ground truth, and a battery of checks any OpenAI-compatible gateway can be run against.

## How it works

You can't point this at an arbitrary live gateway and expect useful results — there's no ground truth to compare against on a real model. Instead:

1. gatewayproof starts a **mock upstream** that speaks the OpenAI `/v1/chat/completions` API, but every response is scripted: you (or the checks) tell it exactly what content, token usage, and timing to produce for a given request.
2. **You configure the gateway under test** to use that mock upstream's URL as its upstream provider (the same way you'd normally point it at `api.openai.com`).
3. gatewayproof sends requests **through your gateway** and asserts that what comes out the other side exactly matches the ground truth the mock upstream scripted in — catching anything your gateway added, dropped, or miscalculated in between.

```
  gatewayproof checks  ──requests──>  [ gateway under test ]  ──requests──>  mock upstream (ground truth)
                       <──responses──                         <──responses──
```

## Install

```bash
npm install --save-dev gatewayproof
```

## Quickstart (CLI)

```bash
# 1. Point your gateway's upstream config at a fixed local port, e.g. http://127.0.0.1:5055
# 2. Start your gateway (it's now configured to forward to that port)
# 3. Run the suite -- it starts the mock upstream on that exact port, then hits your gateway
npx gatewayproof run --target http://localhost:4000 --mock-port 5055
```

```
Mock upstream: http://127.0.0.1:5055
Target gateway: http://localhost:4000

PASS  streaming-fidelity -- Streamed content matches non-streamed content, with no drops, dupes, or reordering
PASS  usage-accuracy -- Reported token usage matches the upstream's actual usage
FAIL  cost-accuracy -- Reported cost matches usage x the supplied pricing table
      expected cost 0.00019999999999999998, got 0.000001
PASS  concurrent-isolation -- Concurrent streamed requests never leak content across streams
PASS  error-propagation -- A mid-stream upstream failure surfaces as an error, never a silently-truncated success

4/5 checks passed.
```

Exit code is `0` on all-pass, `1` otherwise — drop it straight into CI.

## Quickstart (library)

For a self-contained test (you control the gateway's lifecycle, e.g. testing your own gateway's code in its own test suite):

```ts
import { startMockUpstream, runChecks } from "gatewayproof";

const mock = await startMockUpstream(5055); // fixed port your gateway is already configured against
const gateway = await startMyGateway({ upstreamUrl: mock.url });

const report = await runChecks({ targetBaseUrl: gateway.url, mock });
console.log(report.passed, report.results);

await gateway.stop();
await mock.stop();
```

## The checks

| Check | What it catches |
|---|---|
| `streaming-fidelity` | Dropped, duplicated, or reordered SSE chunks — streamed content must reassemble to exactly what non-streamed would return. |
| `usage-accuracy` | Wrong `usage.prompt_tokens` / `completion_tokens` / `total_tokens`, in either streamed (final-chunk) or non-streamed responses. |
| `cost-accuracy` | Wrong cost calculation. Reads the gateway's reported cost via a pluggable `extractCost` function — defaults to LiteLLM's `x-litellm-response-cost` response header — and compares it against `usage x your pricing table`. |
| `concurrent-isolation` | Cross-request content leakage under concurrent streaming load — a real bug class in gateways that multiplex streams over shared state. |
| `error-propagation` | An upstream failure mid-stream getting silently reported as `finish_reason: "stop"` instead of surfacing as an error — the single worst failure mode, because it looks like success. |

Every check is independent and reports its own pass/fail with a specific reason — a gateway can fail one without failing the others.

## Non-goals (v1)

- **Not a load-testing or benchmarking tool.** It checks correctness, not throughput or latency.
- **Not a fuzzer.** Checks use fixed, deterministic scripts, not randomized inputs — that's a natural v2 direction, not v1 scope.
- **Doesn't test provider-specific quirks** (function calling, vision inputs, etc.) in v1 — it covers the universal chat-completions streaming/usage/cost surface every gateway shares.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npx tsx examples/demo.ts   # runs the suite against a correct fixture and a deliberately buggy one
```

## License

MIT
