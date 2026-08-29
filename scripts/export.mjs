// Export all dose data from the Firebase Realtime DB and prune days
// older than RETENTION_DAYS. Expects env FIREBASE_DB_URL (e.g.
// https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app).
// Works because DB rules are open (security-by-obscurity).
import { writeFileSync, mkdirSync } from "node:fs";

const DB_URL = process.env.FIREBASE_DB_URL;
if (!DB_URL) { console.error("FIREBASE_DB_URL not set"); process.exit(1); }

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 28);

const cutoff = new Date();
cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);

const res = await fetch(`${DB_URL}/doses.json`);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
const data = (await res.json()) || {};

mkdirSync("exports", { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
writeFileSync(
  `exports/doses-${stamp}.json`,
  JSON.stringify(data, null, 2)
);
console.log(`Exported ${Object.keys(data).length} day(s) to exports/doses-${stamp}.json`);

// Prune days older than the retention window
for (const dayKey of Object.keys(data)) {
  if (new Date(dayKey) < cutoff) {
    const del = await fetch(`${DB_URL}/doses/${dayKey}.json`, { method: "DELETE" });
    console.log(`${del.ok ? "Pruned" : "Failed to prune"} ${dayKey}`);
  }
}
