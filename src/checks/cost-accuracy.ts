import type { Check, CheckContext, CheckResult } from "../types.js";

export const costAccuracyCheck: Check = {
  id: "cost-accuracy",
  name: "Reported cost matches usage x the supplied pricing table",
  async run(ctx: CheckContext): Promise<CheckResult> {
    const model = "mock-model";
    const pricing = ctx.pricing[model];
    if (!pricing) {
      return {
        id: this.id,
        name: this.name,
        passed: false,
        details: `no pricing entry for "${model}" was supplied -- cost-accuracy cannot run without one`,
      };
    }

    const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 };
    const expectedCost = usage.prompt_tokens * pricing.promptPricePerToken + usage.completion_tokens * pricing.completionPricePerToken;

    ctx.script({ match: "cost-accuracy-nonstream", model, chunks: ["a fixed-length scripted reply body"], usage });
    const res = await fetch(`${ctx.targetBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "cost-accuracy-nonstream" }] }),
    });

    const reportedCost = ctx.extractCost(res);
    if (reportedCost === null) {
      return { id: this.id, name: this.name, passed: false, details: "gateway did not expose a cost on the response (extractCost returned null)" };
    }

    const withinTolerance = Math.abs(reportedCost - expectedCost) < 1e-9;
    if (!withinTolerance) {
      return {
        id: this.id,
        name: this.name,
        passed: false,
        details: `expected cost ${expectedCost}, got ${reportedCost}`,
      };
    }
    return { id: this.id, name: this.name, passed: true, details: `cost matched: ${reportedCost}` };
  },
};
