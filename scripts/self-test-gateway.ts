/**
 * Used only by .github/workflows/test-action.yml to prove the packaged
 * GitHub Action actually works end-to-end against a real gateway, not just
 * its shell script logic. Starts a fixture gateway and writes its
 * dynamically-assigned URL to a file the workflow waits on.
 */
import { writeFileSync } from "node:fs";
import { startReferenceGateway, startBuggyGateway } from "../test/fixtures/gateways.js";

const kind = process.argv[2]; // "reference" | "buggy"
const upstreamUrl = process.argv[3];
const urlFile = process.argv[4];

async function main() {
  const gateway =
    kind === "buggy" ? await startBuggyGateway(upstreamUrl) : await startReferenceGateway(upstreamUrl, 0.000001, 0.000002);

  writeFileSync(urlFile, gateway.url);
  console.log(`${kind} gateway listening at ${gateway.url}, upstream=${upstreamUrl}`);
}

main();
