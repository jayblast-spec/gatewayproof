import { createServer, type Server } from "node:http";

export interface FixtureGateway {
  url: string;
  stop(): Promise<void>;
}

function listen(server: Server): Promise<FixtureGateway> {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("fixture gateway failed to bind a port"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        stop: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

async function readRequestBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function extractUsage(fullText: string): { prompt_tokens: number; completion_tokens: number } | null {
  const usageMatch = fullText.match(/"usage":\s*(\{[^}]*\})/);
  if (!usageMatch) return null;
  return JSON.parse(usageMatch[1]!) as { prompt_tokens: number; completion_tokens: number };
}

/**
 * Fully buffers the upstream's response (streaming or not), computes an
 * accurate cost from the usage it actually reported, and replays the
 * response with an x-litellm-response-cost header -- headers must precede
 * the body, and cost can't be known until the final usage arrives, so a
 * correct gateway either buffers (as this fixture does) or uses HTTP
 * trailers. Should pass every check.
 */
export function startReferenceGateway(upstreamUrl: string, pricePerPromptToken: number, pricePerCompletionToken: number): Promise<FixtureGateway> {
  const server = createServer(async (req, res) => {
    const body = await readRequestBody(req);
    const upstreamRes = await fetch(`${upstreamUrl}${req.url}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    const contentType = upstreamRes.headers.get("content-type") ?? "application/json";
    const fullText = await upstreamRes.text();
    const usage = extractUsage(fullText);
    const headers: Record<string, string> = { "content-type": contentType };
    if (usage) {
      const cost = usage.prompt_tokens * pricePerPromptToken + usage.completion_tokens * pricePerCompletionToken;
      headers["x-litellm-response-cost"] = String(cost);
    }
    res.writeHead(upstreamRes.status, headers);
    res.end(fullText);
  });
  return listen(server);
}

/** Deliberately buggy: drops the final content-bearing chunk of every stream and always reports a hardcoded wrong cost. */
export function startBuggyGateway(upstreamUrl: string): Promise<FixtureGateway> {
  const server = createServer(async (req, res) => {
    const body = await readRequestBody(req);
    const upstreamRes = await fetch(`${upstreamUrl}${req.url}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    const contentType = upstreamRes.headers.get("content-type") ?? "application/json";
    const isStream = contentType.includes("event-stream");
    const fullText = await upstreamRes.text();

    if (!isStream) {
      res.writeHead(upstreamRes.status, { "content-type": contentType, "x-litellm-response-cost": "0.000001" });
      res.end(fullText);
      return;
    }

    const events = fullText.split("\n\n").filter((e) => e.length > 0);
    const contentEventIdx = [...events.keys()].reverse().find((i) => {
      const data = events[i]!.replace(/^data: /, "").trim();
      if (!data || data === "[DONE]") return false;
      try {
        const parsed = JSON.parse(data);
        return typeof parsed.choices?.[0]?.delta?.content === "string" && parsed.choices[0].delta.content.length > 0;
      } catch {
        return false;
      }
    });
    const dropped = contentEventIdx === undefined ? events : events.filter((_, i) => i !== contentEventIdx);

    res.writeHead(upstreamRes.status, { "content-type": contentType, "x-litellm-response-cost": "0.000001" });
    res.end(dropped.map((e) => `${e}\n\n`).join(""));
  });
  return listen(server);
}
