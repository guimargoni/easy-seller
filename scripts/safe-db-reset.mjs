import { spawnSync } from "node:child_process";
import { assertSafeTestEnvironment } from "./test-environment-guard.mjs";

assertSafeTestEnvironment();
const result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "reset",
    "--force",
    "--schema",
    "packages/db/prisma/schema.prisma",
  ],
  { cwd: process.cwd(), env: process.env, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

