/**
 * Runs the full conformance suite against both a correct reference gateway
 * and a deliberately buggy one, so you can see exactly what a real failure
 * looks like. Run with: npx tsx examples/demo.ts
 */
import { startMockUpstream } from "../src/index.js";
import { runChecks } from "../src/runner.js";
import { startReferenceGateway, startBuggyGateway } from "../test/fixtures/gateways.js";

function printReport(label: string, report: Awaited<ReturnType<typeof runChecks>>) {
  console.log(`\n=== ${label} ===`);
  for (const r of report.results) {
    console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.id.padEnd(22)} ${r.details}`);
  }
  console.log(`${report.results.filter((r) => r.passed).length}/${report.results.length} checks passed.`);
}

async function main() {
  const mock1 = await startMockUpstream();
  const reference = await startReferenceGateway(mock1.url, 0.000001, 0.000002);
  printReport("Reference gateway (correct pass-through)", await runChecks({ targetBaseUrl: reference.url, mock: mock1 }));
  await reference.stop();
  await mock1.stop();

  const mock2 = await startMockUpstream();
  const buggy = await startBuggyGateway(mock2.url);
  printReport("Buggy gateway (drops last chunk, hardcodes cost)", await runChecks({ targetBaseUrl: buggy.url, mock: mock2 }));
  await buggy.stop();
  await mock2.stop();
}

main();
