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

export const concurrentIsolationCheck: Check = {
  id: "concurrent-isolation",
  name: "Concurrent streamed requests never leak content across streams",
  async run(ctx: CheckContext): Promise<CheckResult> {
    const N = 6;
    const usage = { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 };

    for (let i = 0; i < N; i++) {
      ctx.script({
        match: `concurrent-isolation-${i}`,
        model: "mock-model",
        chunks: [`REQ-${i}-A `, `REQ-${i}-B `, `REQ-${i}-C`],
        usage,
        chunkDelayMs: 5,
      });
    }

    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        fetch(`${ctx.targetBaseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "mock-model",
            stream: true,
            messages: [{ role: "user", content: `concurrent-isolation-${i}` }],
          }),
        }).then(collectStreamedContent)
      )
    );

    for (let i = 0; i < N; i++) {
      const expected = `REQ-${i}-A REQ-${i}-B REQ-${i}-C`;
      if (results[i] !== expected) {
        return {
          id: this.id,
          name: this.name,
          passed: false,
          details: `request ${i} expected "${expected}", got "${results[i]}" -- either content from another concurrent stream leaked in, or this stream lost content of its own`,
        };
      }
    }
    return { id: this.id, name: this.name, passed: true, details: `all ${N} concurrent streams stayed isolated` };
  },
};
