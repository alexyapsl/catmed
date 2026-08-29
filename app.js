import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, onValue, push, set, remove, update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ---------- Setup ----------
if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.databaseURL) {
  document.getElementById("statusLine").textContent =
    "Missing firebase-config.js — copy firebase-config.example.js and fill in your project keys.";
  throw new Error("no firebase config");
}
const app = initializeApp(window.FIREBASE_CONFIG);
const db = getDatabase(app);

// ---------- HK-time helpers (reset at HK midnight) ----------
const HK = "Asia/Hong_Kong";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: HK });
function dayKey(d) { return dayFmt.format(d); } // YYYY-MM-DD
function todayKey() { return dayKey(new Date()); }
function shiftDay(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(Date.UTC(y, m - 1, d + n)));
}
function fmtTime(ts) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: HK, hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(ts));
}

// ---------- State ----------
let selectedDay = todayKey();
let meds = [];
let dayData = {}; // medId -> { pushId: {ts, by} }
let unsubscribe = null;

const statusLine = document.getElementById("statusLine");
const whoSelect = document.getElementById("whoSelect");
whoSelect.value = localStorage.getItem("cm-who") || "Alex";
whoSelect.addEventListener("change", () =>
  localStorage.setItem("cm-who", whoSelect.value));

// ---------- Load meds (hardcoded list lives in meds.json in the repo) ----------
async function loadMeds() {
  const res = await fetch("meds.json", { cache: "no-store" });
  meds = await res.json();
}

// ---------- Firebase subscription for the selected day ----------
function subscribeDay() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  const r = ref(db, `doses/${selectedDay}`);
  unsubscribe = onValue(r, (snap) => {
    dayData = snap.val() || {};
    render();
  }, (err) => {
    statusLine.textContent = "Firebase error: " + err.message;
  });
}
document.getElementById("prevDay").onclick = () => {
  selectedDay = shiftDay(selectedDay, -1); subscribeDay();
};
document.getElementById("nextDay").onclick = () => {
  selectedDay = shiftDay(selectedDay, 1); subscribeDay();
};

// ---------- Render ----------
function render() {
  document.getElementById("dayLabel").textContent = selectedDay;
  const main = document.getElementById("medCards");
  main.innerHTML = "";
  for (const med of meds) {
    const entries = Object.entries(dayData[med.id] || {})
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.ts - b.ts);
    const max = med.maxPerDay; // null = unlimited
    const count = entries.length;
    const over = max !== null && count > max;
    const complete = max !== null && count === max;

    const card = document.createElement("div");
    card.className = "card" + (over ? " over" : complete ? " complete" : "");
    const h = document.createElement("h2");
    h.textContent = med.name + " ";
    const badge = document.createElement("span");
    badge.className = "badge" + (max === null ? " unlimited" : "");
    badge.textContent = max === null ? "unlimited" : `${max}x daily`;
    h.appendChild(badge);
    card.appendChild(h);

    if (med.timing) {
      const n = document.createElement("div");
      n.className = "notes";
      n.textContent = "⏱ " + med.timing + (med.note ? " · " + med.note : "");
      card.appendChild(n);
    }

    const p = document.createElement("div");
    p.className = "progress";
    p.innerHTML = max === null
      ? `${count} given`
      : `${count}<span class="expected"> / ${max}</span>${over ? " ⚠️ over limit" : ""}`;
    card.appendChild(p);

    const chips = document.createElement("div");
    chips.className = "given";
    const isToday = selectedDay === todayKey();
    for (const e of entries) {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.innerHTML = `${fmtTime(e.ts)} <small>${e.by || ""}</small>`;
      chip.title = "Long-press/right-click to delete; click to edit time";
      chip.onclick = () => editDose(med, e, chip);
      chip.oncontextmenu = (ev) => { ev.preventDefault(); delDose(med, e); };
      chips.appendChild(chip);
    }
    card.appendChild(chips);

    if (isToday) {
      const btn = document.createElement("button");
      btn.className = "add";
      btn.textContent = "Mark given now";
      btn.onclick = () => addDose(med, entries.length);
      card.appendChild(btn);
    }
    main.appendChild(card);
  }
  statusLine.textContent =
    "Live-synced · resets at 00:00 HK · history kept 4 weeks (auto-exported to GitHub)";
}

// ---------- Actions ----------
async function addDose(med, currentCount) {
  if (med.maxPerDay !== null && currentCount >= med.maxPerDay) {
    if (!confirm(`"${med.name}" already has ${currentCount} doses (limit ${med.maxPerDay}). Add another anyway?`)) return;
  }
  const rec = { ts: Date.now(), by: whoSelect.value };
  await push(ref(db, `doses/${selectedDay}/${med.id}`), rec);
}
async function delDose(med, e) {
  if (!confirm(`Delete ${med.name} dose at ${fmtTime(e.ts)}?`)) return;
  await remove(ref(db, `doses/${selectedDay}/${med.id}/${e.id}`));
}
function editDose(med, e, chip) {
  const input = document.createElement("input");
  input.type = "datetime-local";
  input.value = new Date(e.ts - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
  const save = document.createElement("button");
  save.textContent = "✓";
  const cancel = document.createElement("button");
  cancel.textContent = "✕";
  const wrap = document.createElement("span");
  wrap.append(input, save, cancel);
  chip.replaceWith(wrap);
  save.onclick = async () => {
    if (!input.value) return;
    await update(ref(db, `doses/${selectedDay}/${med.id}/${e.id}`), {
      ts: new Date(input.value).getTime(),
    });
  };
  cancel.onclick = render;
}

// ---------- Go ----------
await loadMeds();
document.getElementById("statusLine").textContent = "Connecting…";
subscribeDay();
