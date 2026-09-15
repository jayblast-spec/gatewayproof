import type { Check, CheckContext, CheckResult } from "../types.js";

export const errorPropagationCheck: Check = {
  id: "error-propagation",
  name: "A mid-stream upstream failure surfaces as an error, never a silently-truncated success",
  async run(ctx: CheckContext): Promise<CheckResult> {
    const usage = { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 };
    ctx.script({
      match: "error-propagation-stream",
      model: "mock-model",
      chunks: ["This will ", "never finish"],
      usage,
      errorAfterChunk: 1,
    });

    const res = await fetch(`${ctx.targetBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "mock-model",
        stream: true,
        messages: [{ role: "user", content: "error-propagation-stream" }],
      }),
    });

    if (!res.ok) {
      return { id: this.id, name: this.name, passed: true, details: `gateway surfaced the failure as HTTP ${res.status}` };
    }

    const reader = res.body?.getReader();
    if (!reader) return { id: this.id, name: this.name, passed: false, details: "no response body to inspect" };
    const decoder = new TextDecoder();
    let buffer = "";
    let sawCleanStop = false;
    let sawErrorMarker = false;
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
        if (event.error) sawErrorMarker = true;
        if (event.choices?.[0]?.finish_reason === "stop") sawCleanStop = true;
      }
    }

    if (sawCleanStop && !sawErrorMarker) {
      return {
        id: this.id,
        name: this.name,
        passed: false,
        details: "gateway reported finish_reason: \"stop\" for a stream the upstream actually aborted with an error -- a silent truncation masquerading as success",
      };
    }
    return { id: this.id, name: this.name, passed: true, details: "gateway did not report a clean stop for a stream that failed upstream" };
  },
};
