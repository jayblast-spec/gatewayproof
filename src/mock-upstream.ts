import { createServer, type Server } from "node:http";
import type { ScriptedTurn } from "./types.js";

export interface MockUpstream {
  url: string;
  /** Queue a ground-truth turn. The next request whose messages[0].content equals `match` consumes it. */
  script(turn: ScriptedTurn): void;
  stop(): Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A deterministic OpenAI-compatible /v1/chat/completions upstream. It never
 * calls a real model -- every response is a pre-scripted, known-ground-truth
 * turn, so conformance checks can assert on exact content, exact usage, and
 * exact injected failures instead of guessing what a real model would say.
 */
export function startMockUpstream(port = 0): Promise<MockUpstream> {
  const pending: ScriptedTurn[] = [];

  const server: Server = createServer((req, res) => {
    if (req.method !== "POST" || !req.url?.startsWith("/v1/chat/completions")) {
      res.writeHead(404).end();
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      void handleRequest(body, res);
    });
  });

  async function handleRequest(body: string, res: import("node:http").ServerResponse) {
    let parsed: { model?: string; messages?: Array<{ content?: string }>; stream?: boolean };
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "invalid json" }));
      return;
    }

    const match = parsed.messages?.[0]?.content ?? "";
    const idx = pending.findIndex((t) => t.match === match);
    if (idx === -1) {
      res
        .writeHead(500, { "content-type": "application/json" })
        .end(JSON.stringify({ error: `mock upstream has no scripted turn for "${match}"` }));
      return;
    }
    const turn = pending.splice(idx, 1)[0]!;
    const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (parsed.stream) {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      for (let i = 0; i < turn.chunks.length; i++) {
        if (turn.errorAfterChunk !== undefined && i >= turn.errorAfterChunk) {
          res.write(`data: ${JSON.stringify({ error: { message: "mock upstream injected failure" } })}\n\n`);
          res.end();
          return;
        }
        const event = {
          id,
          object: "chat.completion.chunk",
          model: turn.model,
          choices: [{ index: 0, delta: { content: turn.chunks[i] }, finish_reason: null }],
        };
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (turn.chunkDelayMs) await sleep(turn.chunkDelayMs);
      }

      res.write(
        `data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          model: turn.model,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: turn.usage,
        })}\n\n`
      );
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    if (turn.errorAfterChunk !== undefined) {
      res.writeHead(500, { "content-type": "application/json" }).end(
        JSON.stringify({ error: { message: "mock upstream injected failure" } })
      );
      return;
    }

    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({
        id,
        object: "chat.completion",
        model: turn.model,
        choices: [{ index: 0, message: { role: "assistant", content: turn.chunks.join("") }, finish_reason: "stop" }],
        usage: turn.usage,
      })
    );
  }

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("mock upstream failed to bind a port"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        script: (turn) => pending.push(turn),
        stop: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
