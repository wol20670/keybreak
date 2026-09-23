/**
 * Creates the Firestore composite index the ranking query needs:
 *   scores (dpm DESC, createdAt ASC)
 *
 * Run with:  npm run db:index
 *
 * Uses the Firestore Admin REST API with a token minted from the same service
 * account, so there is no extra dependency and no gcloud/firebase CLI login.
 * Definitions come from firestore.indexes.json. Prints no secret values.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_* environment variables. Run `npm run env:firebase` first.",
  );
  process.exit(1);
}

const { indexes } = JSON.parse(
  await readFile(join(root, "firestore.indexes.json"), "utf8"),
);

const credential = cert({ projectId, clientEmail, privateKey });
const { access_token: token } = await credential.getAccessToken();
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups`;

function describe(index) {
  return `${index.collectionGroup} (${signature(index.fields)})`;
}

/** Stable "field ORDER, field ORDER" string, ignoring the implicit __name__. */
function signature(fields = []) {
  return fields
    .filter((f) => f.fieldPath !== "__name__")
    .map((f) => `${f.fieldPath} ${f.order === "DESCENDING" ? "DESC" : "ASC"}`)
    .join(", ");
}

/**
 * Firestore embeds a ready-to-click index creation URL in the FAILED_PRECONDITION
 * error for the query that needs it. Running the real query is the most reliable
 * way to obtain that link when the Admin API is not permitted.
 */
async function probeIndexUrl() {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp({ credential });
    await getFirestore(app)
      .collection("scores")
      .orderBy("dpm", "desc")
      .orderBy("createdAt", "asc")
      .limit(1)
      .get();
    return null; // query succeeded — the index already serves it
  } catch (error) {
    const match = String(error?.message ?? "").match(
      /https:\/\/console\.firebase\.google\.com\/\S+/,
    );
    return match ? match[0].replace(/[).,]+$/, "") : null;
  }
}

const manualNeeded = [];

for (const index of indexes) {
  process.stdout.write(`${describe(index)}… `);

  const response = await fetch(`${base}/${index.collectionGroup}/indexes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queryScope: index.queryScope,
      fields: index.fields,
    }),
  });

  if (response.ok) {
    console.log("creation started (Firestore builds it in the background)");
    continue;
  }

  const body = await response.json().catch(() => ({}));
  const status = body?.error?.status;

  if (response.status === 409 || status === "ALREADY_EXISTS") {
    console.log("already exists");
    continue;
  }

  console.log(`cannot create via API (HTTP ${response.status} ${status ?? ""})`);
  if (status === "PERMISSION_DENIED") {
    console.log(
      "  The service account lacks the Cloud Datastore Index Admin role.\n" +
        "  Either grant it, or create the index from the console link below.",
    );
  } else {
    console.log(`  ${body?.error?.message ?? "unknown error"}`);
  }
  manualNeeded.push(index);
}

// Readiness is decided by the actual query, not by what the API let us do.
const wanted = signature(indexes[0].fields);
let ready = false;

const listed = await fetch(`${base}/scores/indexes`, {
  headers: { Authorization: `Bearer ${token}` },
});

if (listed.ok) {
  const { indexes: existing = [] } = await listed.json();
  console.log("\nCurrent scores indexes:");
  if (existing.length === 0) console.log("  (none)");
  for (const index of existing) {
    const fields = signature(index.fields);
    console.log(`  [${index.state}] ${fields || "(single field)"}`);
    if (fields === wanted && index.state === "READY") ready = true;
  }
} else {
  // Cannot list either — fall back to asking Firestore directly.
  ready = (await probeIndexUrl()) === null;
  console.log(`\nIndex readiness (probed by query): ${ready ? "READY" : "not ready"}`);
}

// `--wait` polls until the index actually serves the query. Useful when the
// index was created from the console link and we need to know when it is live.
if (!ready && process.argv.includes("--wait")) {
  const deadline = Date.now() + 10 * 60 * 1000;
  process.stdout.write("\nWaiting for the index to become READY");
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    process.stdout.write(".");
    if ((await probeIndexUrl()) === null) {
      ready = true;
      break;
    }
  }
  console.log("");
}

if (ready) {
  console.log("\nIndex is READY — the ranking uses the exact ordered query.");
} else {
  console.log(
    "\nIndex is not READY yet — the ranking stays on the in-memory fallback.",
  );
  if (manualNeeded.length) {
    const url = await probeIndexUrl();
    console.log("\nCreate it with one click:");
    console.log(
      `  ${
        url ??
        `https://console.firebase.google.com/project/${projectId}/firestore/indexes`
      }`,
    );
    console.log(`  (collection "scores", ${wanted})`);
  }
  process.exitCode = 1;
}
