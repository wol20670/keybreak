/**
 * Registers the Firebase service account values as Vercel environment
 * variables.
 *
 * Run with:  node scripts/push-vercel-env.mjs [environment]   (default: production)
 *
 * Values are piped to `vercel env add` over stdin, never passed as CLI
 * arguments — arguments would be visible in shell history and in the process
 * list. Nothing is printed except the variable name and status.
 */
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] ?? "production";

const account = JSON.parse(
  await readFile(join(root, "firebase-service-account.json"), "utf8"),
);

const vars = {
  FIREBASE_PROJECT_ID: account.project_id,
  FIREBASE_CLIENT_EMAIL: account.client_email,
  // Sent as the original PEM with real newlines; lib/firebase.ts accepts that
  // form as well as the escaped one.
  FIREBASE_PRIVATE_KEY: account.private_key,
};

/** Runs a vercel command, optionally writing `input` to its stdin. */
function vercel(args, input) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["--yes", "vercel@latest", ...args], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      // Windows needs a shell to resolve npx.cmd. Only variable names and the
      // target environment go through argv — secret values stay on stdin.
      shell: process.platform === "win32",
    });

    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));

    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
  });
}

for (const [name, value] of Object.entries(vars)) {
  process.stdout.write(`${name} (${String(value).length} chars) -> `);

  let result = await vercel(["env", "add", name, target], value);

  // Replacing an existing variable needs an explicit removal first.
  if (result.code !== 0 && /already exists/i.test(result.out)) {
    await vercel(["env", "rm", name, target, "--yes"]);
    result = await vercel(["env", "add", name, target], value);
  }

  if (result.code === 0) {
    console.log(`added to ${target}`);
  } else {
    console.log(`FAILED`);
    // Print only the diagnostic lines, never the echoed value.
    const reason = result.out
      .split("\n")
      .filter((line) => /error|Error|denied|not authorized/.test(line))
      .join(" | ");
    console.error(`  ${reason || `exit code ${result.code}`}`);
    process.exitCode = 1;
  }
}

console.log("\nNo values were printed.");
