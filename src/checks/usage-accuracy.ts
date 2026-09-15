import type { Check, CheckContext, CheckResult, Usage } from "../types.js";

async function collectFinalUsage(res: Response): Promise<Usage | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: Usage | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.replace(/^data: /, "").trim();
      if (!data || data === "[DONE]") continue;
      const event = JSON.parse(data);
      if (event.usage) usage = event.usage;
    }
  }
  return usage;
}

export const usageAccuracyCheck: Check = {
  id: "usage-accuracy",
  name: "Reported token usage matches the upstream's actual usage, for both streamed and non-streamed responses",
  async run(ctx: CheckContext): Promise<CheckResult> {
    const usage: Usage = { prompt_tokens: 42, completion_tokens: 7, total_tokens: 49 };

    ctx.script({ match: "usage-accuracy-nonstream", model: "mock-model", chunks: ["seven word response here right now"], usage });
    const nonStreamRes = await fetch(`${ctx.targetBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "mock-model", messages: [{ role: "user", content: "usage-accuracy-nonstream" }] }),
    });
    const nonStreamBody = (await nonStreamRes.json()) as { usage?: Usage };
    if (JSON.stringify(nonStreamBody.usage) !== JSON.stringify(usage)) {
      return {
        id: this.id,
        name: this.name,
        passed: false,
        details: `non-streamed usage mismatch: expected ${JSON.stringify(usage)}, got ${JSON.stringify(nonStreamBody.usage)}`,
      };
    }

    ctx.script({ match: "usage-accuracy-stream", model: "mock-model", chunks: ["seven word response here right now"], usage });
    const streamRes = await fetch(`${ctx.targetBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "mock-model",
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: "user", content: "usage-accuracy-stream" }],
      }),
    });
    const streamedUsage = await collectFinalUsage(streamRes);
    if (JSON.stringify(streamedUsage) !== JSON.stringify(usage)) {
      return {
        id: this.id,
        name: this.name,
        passed: false,
        details: `streamed usage mismatch: expected ${JSON.stringify(usage)}, got ${JSON.stringify(streamedUsage)}`,
      };
    }

    return { id: this.id, name: this.name, passed: true, details: "usage matched exactly for both streamed and non-streamed responses" };
  },
};
