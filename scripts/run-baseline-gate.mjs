import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { assertSafeTestEnvironment } from "./test-environment-guard.mjs";

assertSafeTestEnvironment({ requireApi: true });
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("BASELINE_GATE: npm_execpath indisponível; execute por 'npm run test:baseline'.");

function runNpm(...args) {
  console.log(`\n[baseline] npm ${args.join(" ")}`);
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`BASELINE_GATE: npm ${args.join(" ")} falhou com ${result.status}.`);
}

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function waitForApi(url) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error("BASELINE_GATE: API local não ficou pronta.");
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(3_000)]);
  if (child.exitCode === null) child.kill();
}

runNpm("run", "lint");
runNpm("run", "typecheck");
runNpm("test");
runNpm("run", "build");
runNpm("run", "db:generate");
runNpm("run", "db:reset");
runNpm("run", "db:seed");
runNpm("run", "test:db");

const apiUrl = process.env.API_URL ?? "http://localhost:3334";
const apiPort = new URL(apiUrl).port || "3334";
const api = spawn(process.execPath, ["--import", "tsx", "apps/api/src/server.ts"], {
  cwd: process.cwd(),
  env: { ...process.env, API_PORT: apiPort },
  stdio: "inherit",
});
try {
  await waitForApi(apiUrl);
  runNpm("run", "smoke");
} finally {
  await stop(api);
}

runNpm("run", "smoke:phase3");
runNpm("run", "test:worker");
console.log("\nMILESTONE 0 BASELINE GATE: PASS");
