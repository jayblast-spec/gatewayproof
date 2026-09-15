export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface PricingEntry {
  promptPricePerToken: number;
  completionPricePerToken: number;
}

export type PricingTable = Record<string, PricingEntry>;

/** One deterministic, ground-truth response the mock upstream will produce for the next matching request. */
export interface ScriptedTurn {
  /** Matched against the request body's messages[0].content so concurrent requests each get their own turn. */
  match: string;
  model: string;
  /** Content chunks emitted one per SSE event, in order, for streaming responses. Joined for non-streaming. */
  chunks: string[];
  usage: Usage;
  /** If set, the mock aborts the stream with an error after emitting this many chunks (0-indexed count). */
  errorAfterChunk?: number;
  /** Per-chunk delay in ms, to make interleaving observable under concurrency. */
  chunkDelayMs?: number;
}

export interface CheckContext {
  /** Base URL of the gateway under test, e.g. http://localhost:4000 */
  targetBaseUrl: string;
  /** Base URL of the mock upstream this suite started, for reference/logging only -- the gateway must already be configured to forward to it. */
  mockUpstreamUrl: string;
  script: (turn: ScriptedTurn) => void;
  pricing: PricingTable;
  /** Extracts the cost the gateway reports for a response, however that gateway exposes it. */
  extractCost: (response: Response) => number | null;
}

export interface CheckResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

export interface Check {
  id: string;
  name: string;
  run(ctx: CheckContext): Promise<CheckResult>;
}

export interface ConformanceReport {
  results: CheckResult[];
  passed: boolean;
}
