import { basePath } from "../base-path.mjs";

const repo = "https://github.com/jayblast-spec/gatewayproof";

const checks = [
  {
    id: "streaming-fidelity",
    bug: "A dropped, duplicated, or reordered chunk mid-stream. The streamed response, reassembled, does not match a non-streamed call for the same request.",
  },
  {
    id: "usage-accuracy",
    bug: "Wrong prompt_tokens, completion_tokens, or total_tokens, in a streamed final chunk or a non-streamed response body.",
  },
  {
    id: "cost-accuracy",
    bug: "A wrong cost calculation. The check reads the gateway's reported cost (LiteLLM's x-litellm-response-cost header by default, pluggable for others) and compares it with usage times your pricing table.",
  },
  {
    id: "concurrent-isolation",
    bug: "Content from one concurrent request leaking into another's stream, which shows up in gateways that multiplex streams over shared internal state.",
  },
  {
    id: "error-propagation",
    bug: "An upstream error mid-stream reported to the caller as a clean finish_reason of stop, which looks exactly like success.",
  },
];

export default function HomePage() {
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href={`${basePath}/`}>
          gatewayproof
        </a>
        <nav aria-label="Documentation">
          <a href="#how">How it works</a>
          <a href="#checks">Checks</a>
          <a href="#quickstart">Quickstart</a>
          <a href="#action">Action</a>
          <a href="#library">Library</a>
          <a href={repo}>GitHub</a>
        </nav>
      </header>
      <div className="wrap">
        <header className="hero">
          <p className="kicker">Docs</p>
          <h1>Conformance tests for OpenAI-compatible LLM gateways</h1>
          <p className="lede">
            gatewayproof catches streaming, usage, cost, concurrency, and error-handling bugs that an
            eyeball review of a diff will not. It compares your gateway with a deterministic mock
            upstream, so the expected response is known before the request is sent.
          </p>
          <img
            className="banner"
            src={`${basePath}/banner.svg`}
            alt="gatewayproof sends scripted requests through a gateway to a deterministic mock upstream, then scores streaming, usage, cost, concurrency, and error handling."
          />
          <div className="actions">
            <a className="button primary" href="#quickstart">
              Run the suite
            </a>
            <a className="button secondary" href="https://www.npmjs.com/package/gatewayproof">
              npm package
            </a>
            <a className="button secondary" href={repo}>
              Source
            </a>
          </div>
        </header>
        <main id="content">
          <section id="why">
            <h2>Why the bugs are easy to miss</h2>
            <p>
              An LLM gateway sits between your application and the model provider. On every request it
              re-streams the response, recomputes token usage, calculates cost, and propagates upstream
              failures. A gateway that drops the last streamed chunk still looks successful in a quick
              manual test. A wrong cost still returns a number. An upstream error swallowed as{" "}
              <code>finish_reason: &quot;stop&quot;</code> looks like a complete answer.
            </p>
            <p>
              There is no ground truth when a real model is in the path, because you do not know in
              advance what it should say. gatewayproof replaces that provider with a scripted mock.
            </p>
          </section>
          <section id="how">
            <h2>How it works</h2>
            <ol>
              <li>
                gatewayproof starts a mock upstream that speaks <code>/v1/chat/completions</code>. Every
                response is scripted: content, token usage, and timing are the ground truth.
              </li>
              <li>
                You point the gateway under test at that mock, the same way you would point it at{" "}
                <code>api.openai.com</code>.
              </li>
              <li>
                gatewayproof sends requests through your gateway and compares what comes back with the
                script. Anything the gateway added, dropped, or miscalculated fails the check.
              </li>
            </ol>
            <div className="flow" role="img" aria-label="Request flow from gatewayproof through the gateway to the mock upstream and back.">
{`gatewayproof checks  -->  [ gateway under test ]  -->  mock upstream
                   <--                         <--`}
            </div>
          </section>
          <section id="checks">
            <h2>The five checks</h2>
            <p>Each check is independent. A gateway can fail one without failing the others.</p>
            <table>
              <thead>
                <tr>
                  <th scope="col">Check</th>
                  <th scope="col">Bug it catches</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={check.id}>
                    <th scope="row">
                      <code>{check.id}</code>
                    </th>
                    <td>{check.bug}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section id="quickstart">
            <h2>Quickstart</h2>
            <p>
              Pick a fixed local port, configure the gateway&apos;s upstream to that port, and start the
              gateway. The suite binds the mock to that same port, then calls the gateway.
            </p>
            <pre>
              <code>{`npx gatewayproof run --target http://localhost:4000 --mock-port 5055`}</code>
            </pre>
            <pre>
              <code>{`Mock upstream: http://127.0.0.1:5055
Target gateway: http://localhost:4000

PASS  streaming-fidelity -- Streamed content matches non-streamed content
PASS  usage-accuracy -- Reported token usage matches the upstream
FAIL  cost-accuracy -- Reported cost matches usage x the pricing table
      expected cost 0.00019999999999999998, got 0.000001
PASS  concurrent-isolation -- Concurrent streams never leak content
PASS  error-propagation -- A mid-stream failure surfaces as an error

4/5 checks passed.`}</code>
            </pre>
            <p>
              Exit code <code>0</code> means every check passed. Exit code <code>1</code> means at least
              one failed.
            </p>
            <h3>Install</h3>
            <pre>
              <code>npm install --save-dev gatewayproof</code>
            </pre>
          </section>
          <section id="action">
            <h2>GitHub Action</h2>
            <p>
              The reusable action builds the suite and runs it against a gateway you have already
              started. <code>mock-port</code> must be the port that gateway is configured to forward to.
            </p>
            <pre>
              <code>{`- name: Start your gateway
  run: |
    my-gateway serve --port 4000 &
    sleep 2

- name: Run gatewayproof against it
  uses: jayblast-spec/gatewayproof@main
  with:
    target: http://localhost:4000
    mock-port: '5055'`}</code>
            </pre>
          </section>
          <section id="library">
            <h2>Library</h2>
            <p>
              Use the library when a test owns the gateway process and can point it at the mock URL
              directly.
            </p>
            <pre>
              <code>{`import { startMockUpstream, runChecks } from "gatewayproof";

const mock = await startMockUpstream(5055);
const gateway = await startMyGateway({ upstreamUrl: mock.url });

const report = await runChecks({ targetBaseUrl: gateway.url, mock });
console.log(report.passed, report.results);

await gateway.stop();
await mock.stop();`}</code>
            </pre>
          </section>
          <section id="scope">
            <h2>What v1 does not do</h2>
            <ul>
              <li>It is not a load test or a latency benchmark. The scenarios are few and scripted.</li>
              <li>It is not a fuzzer. Each check uses a fixed script.</li>
              <li>
                It does not cover provider-specific features such as function calling or vision. It
                covers the chat-completions streaming, usage, and cost surface that OpenAI-compatible
                gateways share.
              </li>
            </ul>
            <p className="note">
              This site is a static export of the project docs. The conformance suite itself runs
              locally or in GitHub Actions against your gateway. It does not run in the browser.
            </p>
          </section>
          <section id="support">
            <h2>Support</h2>
            <ul>
              <li>
                <a href="https://veroputech.gumroad.com/l/llm-gateway-conformance-check-48h">
                  LLM Gateway Conformance Check (48h, $99)
                </a>{" "}
                — the suite run against your gateway, with a written report.
              </li>
              <li>
                <a href="https://veroputech.gumroad.com/l/ci-gate-setup-48h">CI Gate Setup (48h, $149)</a>{" "}
                — a pull request that adds gatewayproof to your GitHub Actions with a passing run.
              </li>
              <li>
                <a href="https://veroputech.gumroad.com/l/ci-infra-tool-pack">CI / Infra Tool Pack</a> —
                the repo, the npm name, and the copyright are for sale together. Use under MIT stays
                free either way.
              </li>
            </ul>
          </section>
        </main>
        <footer>
          <p>
            MIT licensed. Built by <a href="https://github.com/jayblast-spec">ArkNet Digital</a>.{" "}
            <a href={`${repo}#readme`}>README</a>
            {" · "}
            <a href={`${repo}/blob/main/LICENSE`}>License</a>
          </p>
        </footer>
      </div>
    </>
  );
}
