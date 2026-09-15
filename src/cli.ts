#!/usr/bin/env node
import { runConformanceSuite } from "./runner.js";

function parseArgs(argv: string[]): { target?: string; mockPort?: number } {
  const args: { target?: string; mockPort?: number } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target") args.target = argv[++i];
    if (argv[i] === "--mock-port") args.mockPort = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const { target, mockPort } = parseArgs(process.argv.slice(2));
  if (!target) {
    console.error("Usage: gatewayproof run --target <gateway-base-url> [--mock-port <port>]");
    console.error("\nThe gateway at --target must already be configured to forward its upstream");
    console.error("requests to the mock upstream URL -- pass a fixed --mock-port so you can point");
    console.error("your gateway config at it (e.g. http://127.0.0.1:5055) before running this.");
    process.exit(2);
  }

  const report = await runConformanceSuite({ targetBaseUrl: target, mockUpstreamPort: mockPort });

  console.log(`\nMock upstream: ${report.mockUpstreamUrl}`);
  console.log(`Target gateway: ${target}\n`);
  for (const result of report.results) {
    console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.id} -- ${result.name}`);
    if (!result.passed) console.log(`      ${result.details}`);
  }
  console.log(`\n${report.results.filter((r) => r.passed).length}/${report.results.length} checks passed.`);
  process.exit(report.passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
