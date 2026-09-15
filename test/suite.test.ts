import { afterEach, describe, expect, it } from "vitest";
import { startMockUpstream, type MockUpstream } from "../src/mock-upstream.js";
import { runChecks } from "../src/runner.js";
import { startReferenceGateway, startBuggyGateway, type FixtureGateway } from "./fixtures/gateways.js";

let mock: MockUpstream | undefined;
let gateway: FixtureGateway | undefined;

afterEach(async () => {
  await gateway?.stop();
  await mock?.stop();
  mock = undefined;
  gateway = undefined;
});

describe("against a correct reference gateway", () => {
  it("passes every check", async () => {
    mock = await startMockUpstream();
    gateway = await startReferenceGateway(mock.url, 0.000001, 0.000002);

    const report = await runChecks({ targetBaseUrl: gateway.url, mock });

    for (const r of report.results) {
      expect(r.passed, `${r.id}: ${r.details}`).toBe(true);
    }
    expect(report.passed).toBe(true);
  });
});

describe("against a deliberately buggy gateway", () => {
  it("fails streaming-fidelity (dropped chunk) and cost-accuracy (hardcoded cost)", async () => {
    mock = await startMockUpstream();
    gateway = await startBuggyGateway(mock.url);

    const report = await runChecks({ targetBaseUrl: gateway.url, mock });
    const byId = Object.fromEntries(report.results.map((r) => [r.id, r]));

    expect(byId["streaming-fidelity"]?.passed, byId["streaming-fidelity"]?.details).toBe(false);
    expect(byId["cost-accuracy"]?.passed, byId["cost-accuracy"]?.details).toBe(false);
    // The bug only drops a content chunk, not the final usage-bearing event -- usage-accuracy
    // legitimately still passes here, which is itself useful signal: these checks are independent,
    // not redundant with each other.
    expect(byId["usage-accuracy"]?.passed).toBe(true);
    expect(report.passed).toBe(false);
  });
});

describe("individual check behavior", () => {
  it("cost-accuracy fails cleanly when no pricing entry is supplied for the model", async () => {
    mock = await startMockUpstream();
    gateway = await startReferenceGateway(mock.url, 0.000001, 0.000002);

    const report = await runChecks({ targetBaseUrl: gateway.url, mock, pricing: {} });
    const cost = report.results.find((r) => r.id === "cost-accuracy");
    expect(cost?.passed).toBe(false);
    expect(cost?.details).toMatch(/no pricing entry/);
  });
});
