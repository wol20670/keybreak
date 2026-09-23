/**
 * Verifies that the Firebase Admin SDK can reach Firestore with the
 * credentials in .env.
 *
 * Run with:  npm run db:check
 *
 * Read-only on purpose — it proves auth, connectivity and permissions without
 * leaving a throwaway document behind. Prints no secret values.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_* environment variables. Run `npm run env:firebase` first.",
  );
  process.exit(1);
}

const credential = cert({ projectId, clientEmail, privateKey });
const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential });
const db = getFirestore(app);

console.log(`project:        ${projectId}`);
console.log(`service account: ...@${clientEmail.split("@")[1]}`);

// Database metadata (location) via the Firestore Admin REST API, using a token
// minted from the same service account — no extra dependency needed.
try {
  const { access_token: token } = await credential.getAccessToken();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (response.ok) {
    const database = await response.json();
    console.log(`location:       ${database.locationId}`);
    console.log(`type:           ${database.type}`);
    console.log(`concurrency:    ${database.concurrencyMode ?? "n/a"}`);
  } else {
    console.log(`location:       (could not read: HTTP ${response.status})`);
  }
} catch (error) {
  console.log(`location:       (could not read: ${error.message})`);
}

try {
  const collections = await db.listCollections();
  console.log(
    `collections:    ${
      collections.length ? collections.map((c) => c.id).join(", ") : "(none yet)"
    }`,
  );

  const snapshot = await db.collection("scores").count().get();
  console.log(`scores docs:    ${snapshot.data().count}`);
  console.log("\nFirestore connection OK.");
} catch (error) {
  console.error(`\nFirestore connection FAILED: [${error.code}] ${error.message}`);
  process.exit(1);
}
