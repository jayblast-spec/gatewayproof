import { startMockUpstream, type MockUpstream } from "./mock-upstream.js";
import { streamingFidelityCheck } from "./checks/streaming-fidelity.js";
import { usageAccuracyCheck } from "./checks/usage-accuracy.js";
import { costAccuracyCheck } from "./checks/cost-accuracy.js";
import { concurrentIsolationCheck } from "./checks/concurrent-isolation.js";
import { errorPropagationCheck } from "./checks/error-propagation.js";
import type { Check, ConformanceReport, PricingTable } from "./types.js";

export const ALL_CHECKS: Check[] = [
  streamingFidelityCheck,
  usageAccuracyCheck,
  costAccuracyCheck,
  concurrentIsolationCheck,
  errorPropagationCheck,
];

export interface RunConformanceOptions {
  targetBaseUrl: string;
  /** Which of ALL_CHECKS to run. Defaults to all of them. */
  checks?: Check[];
  pricing?: PricingTable;
  /** How to read the gateway's reported cost off a Response. Defaults to LiteLLM's x-litellm-response-cost header. */
  extractCost?: (response: Response) => number | null;
  mockUpstreamPort?: number;
}

const DEFAULT_PRICING: PricingTable = {
  "mock-model": { promptPricePerToken: 0.000001, completionPricePerToken: 0.000002 },
};

function defaultExtractCost(response: Response): number | null {
  const header = response.headers.get("x-litellm-response-cost");
  if (header === null) return null;
  const value = Number(header);
  return Number.isNaN(value) ? null : value;
}

export interface RunChecksOptions {
  targetBaseUrl: string;
  mock: MockUpstream;
  checks?: Check[];
  pricing?: PricingTable;
  extractCost?: (response: Response) => number | null;
}

/**
 * Runs the requested checks against `targetBaseUrl` using an *already
 * running* mock upstream. Use this when you control the gateway-under-test's
 * lifecycle yourself (as tests and the demo do) and need the mock's URL
 * before the gateway can even start.
 */
export async function runChecks(options: RunChecksOptions): Promise<ConformanceReport> {
  const checks = options.checks ?? ALL_CHECKS;
  const pricing = options.pricing ?? DEFAULT_PRICING;
  const extractCost = options.extractCost ?? defaultExtractCost;

  const results = [];
  for (const check of checks) {
    const result = await check.run({
      targetBaseUrl: options.targetBaseUrl,
      mockUpstreamUrl: options.mock.url,
      script: options.mock.script,
      pricing,
      extractCost,
    });
    results.push(result);
  }
  return { results, passed: results.every((r) => r.passed) };
}

/**
 * Convenience wrapper for the common case (the CLI): start a fresh mock
 * upstream on a known port, run the checks against `targetBaseUrl` (a
 * gateway that must already be configured, out-of-band, to forward its
 * upstream requests to that port), then tear the mock down.
 */
export async function runConformanceSuite(options: RunConformanceOptions): Promise<ConformanceReport & { mockUpstreamUrl: string }> {
  const mock = await startMockUpstream(options.mockUpstreamPort ?? 0);
  try {
    const report = await runChecks({ ...options, mock });
    return { ...report, mockUpstreamUrl: mock.url };
  } finally {
    await mock.stop();
  }
}
