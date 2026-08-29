# 🐱 Cat Med Tracker

Vanilla JS + Firebase Realtime DB app hosted on GitHub Pages. Two phones (Alex + Wife)
see the same live state; day resets at 00:00 Asia/Hong_Kong.

## What it does
- One card per medication (hardcoded in `meds.json`):
  - expected doses/day (`maxPerDay`, `null` = unlimited)
  - timing rule label (e.g. "after meals")
  - doses given today with time + who gave it
- "Mark given now" (defaults to current time); click a dose chip to edit its time;
  right-click / long-press a chip to delete it. Over-limit adds are allowed but warned.
- Day navigator ◀ ▶ with full history (last 4 weeks).
- Nightly GitHub Action: exports all data to `exports/doses-YYYY-MM-DD.json` and
  deletes days older than 28 days (see `.github/workflows/export.yml`).

## Setup (one-time, ~20 min)
1. **Firebase project**
   - https://console.firebase.google.com → Add project → disable GA if asked.
   - Build → Realtime Database → Create database → pick `asia-southeast1` →
     start in **test mode** (open rules, security-by-obscurity — fine for this).
   - Project settings → General → "Add app → Web" → copy the config object.
2. **App config**
   - `cp firebase-config.example.js firebase-config.js` and paste the values.
   - `firebase-config.js` is gitignored; only the example ships to the repo.
3. **GitHub repo + Pages**
   - Push this folder to a repo, then Settings → Pages → deploy from `main` (root).
   - Add repo variable `FIREBASE_DB_URL` (Settings → Secrets and variables →
     Actions → **Variables**) = your database URL, for the export job.
4. **First run**
   - Open the Pages URL on both phones; add to home screen.

## Editing meds
Edit `meds.json` and push — no admin UI on purpose.

| field | meaning |
|---|---|
| `id` | stable key stored in Firebase |
| `name` | display name |
| `maxPerDay` | integer, or `null` for unlimited |
| `timing` | label e.g. "after meals" |
| `note` | extra hint |

## Notes / risks
- Open rules mean **anyone with the URL can read/write/delete** — acceptable for cat
  meds; don't reuse the DB elsewhere. If you want, add a simple shared-password gate
  later (Firebase rules can be tightened to a token).
- Export job relies on the open rules too; the URL shouldn't leak if the repo is private
  and `firebase-config.js` stays untracked.
