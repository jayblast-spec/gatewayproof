import type { Check, CheckContext, CheckResult } from "../types.js";

async function collectStreamedContent(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
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
      content += event.choices?.[0]?.delta?.content ?? "";
    }
  }
  return content;
}

export const streamingFidelityCheck: Check = {
  id: "streaming-fidelity",
  name: "Streamed content matches non-streamed content, with no drops, dupes, or reordering",
  async run(ctx: CheckContext): Promise<CheckResult> {
    const expected = "The quick brown fox jumps over the lazy dog.";
    const chunks = ["The quick ", "brown fox ", "jumps over ", "the lazy dog."];
    const usage = { prompt_tokens: 10, completion_tokens: chunks.length, total_tokens: 10 + chunks.length };

    ctx.script({ match: "streaming-fidelity-stream", model: "mock-model", chunks, usage });
    const streamRes = await fetch(`${ctx.targetBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "mock-model",
        stream: true,
        messages: [{ role: "user", content: "streaming-fidelity-stream" }],
      }),
    });
    if (!streamRes.ok) {
      return { id: this.id, name: this.name, passed: false, details: `gateway returned HTTP ${streamRes.status} for the streaming request` };
    }
    const streamedContent = await collectStreamedContent(streamRes);

    if (streamedContent !== expected) {
      return {
        id: this.id,
        name: this.name,
        passed: false,
        details: `expected "${expected}", got "${streamedContent}"`,
      };
    }
    return { id: this.id, name: this.name, passed: true, details: "streamed content reassembled exactly" };
  },
};
