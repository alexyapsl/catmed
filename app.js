import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, onValue, push, remove, update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.databaseURL) {
  document.getElementById("statusLine").textContent =
    "Missing firebase-config.js — copy firebase-config.example.js and fill in your project keys.";
  throw new Error("no firebase config");
}
const app = initializeApp(window.FIREBASE_CONFIG);
const db = getDatabase(app);

const HK = "Asia/Hong_Kong";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: HK });
function dayKey(d) { return dayFmt.format(d); }
function todayKey() { return dayKey(new Date()); }
function shiftDay(key, n) {
  const [y, m, d] = key.split("-");
  return dayKey(new Date(Date.UTC(+y, +m - 1, +d + n)));
}
let selectedDay = todayKey();
let dayData = {};

// ---------- Render ----------
function render() {
  document.getElementById("dayLabel").textContent = selectedDay;
  const main = document.getElementById("medCards");
  main.innerHTML = "";

  for (const med of meds) {
    const entriesData = dayData[med.id] || {};
    const entries = Object.entries(entriesData).map(([id, v]) => ({ id, ...v }));
    const count = entries.length;
    const over = med.maxPerDay !== null && count > med.maxPerDay;
    const complete = med.maxPerDay !== null && count === med.maxPerDay;

    const card = document.createElement("div");
    card.className = "card" + (over ? " over" : complete ? " complete" : "");

    const h = document.createElement("h2");
    h.textContent = med.name + " ";
    const badge = document.createElement("span");
    badge.className = "badge" + (med.maxPerDay === null ? " unlimited" : "");
    badge.textContent = med.maxPerDay === null ? "unlimited" : `${med.maxPerDay}x daily`;
    h.appendChild(badge);
    card.appendChild(h);

    if (med.timing) {
      const note = document.createElement("div");
      note.className = "notes";
      note.textContent = "⏱ " + med.timing + (med.note ? " · " + med.note : "");
      card.appendChild(note);
    }

    const p = document.createElement("div");
    p.className = "progress";
    p.innerHTML = med.maxPerDay === null
      ? `${count} given`
      : `${count}<span class="expected"> / ${med.maxPerDay}</span>${over ? " ⚠️ over limit" : ""}`;
    card.appendChild(p);

    const chips = document.createElement("div");
    chips.className = "given";
    for (const e of entries.sort((a, b) => a.ts - b.ts)) {
      const chip = document.createElement("button");
      chip.className = "chip";
      const timeStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: HK, hour: "2-digit", minute: "2-digit", hour12: false
      }).format(new Date(e.ts));
      chip.innerHTML = `${timeStr} <small>by ${e.by}</small>`;
      chip.title = "Long-press/right-click to delete; click to edit time";
      chip.onclick = () => editDose(med, e, chip);
      chip.oncontextmenu = (ev) => { ev.preventDefault(); delDose(med, e); };
      chips.appendChild(chip);
    }
    card.appendChild(chips);

    const isToday = selectedDay === todayKey();
    if (isToday) {
      const actions = document.createElement("div");
      actions.className = "actions";
      const alexBtn = document.createElement("button");
      alexBtn.className = "add";
      alexBtn.textContent = "Alex given";
      alexBtn.onclick = () => addDose(med, entries.length, "Alex");
      const wifeBtn = document.createElement("button");
      wifeBtn.className = "add";
      wifeBtn.textContent = "Wife given";
      wifeBtn.onclick = () => addDose(med, entries.length, "Wife");
      actions.append(alexBtn, wifeBtn);
      card.appendChild(actions);
    }
    main.appendChild(card);
  }

  document.getElementById("statusLine").textContent =
    "Live · resets at 00:00 HK · history kept 4 weeks (auto-exported to GitHub)";
}

// ---------- Actions ----------
async function addDose(med, currentCount, by) {
  if (med.maxPerDay !== null && currentCount >= med.maxPerDay) {
    if (!confirm(`"${med.name}" already has ${currentCount} doses (limit ${med.maxPerDay}). Add another anyway?`)) return;
  }
  await push(ref(db, `doses/${selectedDay}/${med.id}`), {
    ts: Date.now(),
    by: by
  });
}
async function delDose(med, e) {
  if (!confirm(`Delete this ${med.name} dose?`)) return;
  await remove(ref(db, `doses/${selectedDay}/${med.id}/${e.id}`));
}
function editDose(med, e, chip) {
  const wrap = document.createElement("div");
  wrap.className = "editRow";
  const input = document.createElement("input");
  input.type = "datetime-local";
  input.value = new Date(e.ts - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
  const btns = document.createElement("div");
  btns.className = "editBtns";
  const save = document.createElement("button");
  save.className = "okBig";
  save.textContent = "✓ Save";
  const cancel = document.createElement("button");
  cancel.className = "noBig";
  cancel.textContent = "✕ Cancel";
  btns.append(save, cancel);
  wrap.append(input, btns);
  chip.replaceWith(wrap);
  save.onclick = async () => {
    if (!input.value) return;
    await update(ref(db, `doses/${selectedDay}/${med.id}/${e.id}`), {
      ts: new Date(input.value).getTime(),
    });
  };
  cancel.onclick = render;
}

// ---------- Wire up ----------
let meds = [];
document.getElementById("prevDay").onclick = () => { selectedDay = shiftDay(selectedDay, -1); subscribeDay(); };
document.getElementById("nextDay").onclick = () => { selectedDay = shiftDay(selectedDay, 1); subscribeDay(); };

let unsubscribe = null;
function subscribeDay() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  const r = ref(db, `doses/${selectedDay}`);
  unsubscribe = onValue(r, (snap) => {
    dayData = snap.val() || {};
    render();
  }, (err) => {
    document.getElementById("statusLine").textContent = "Firebase error: " + err.message;
  });
}

fetch("meds.json", { cache: "no-store" })
  .then(r => { if (!r.ok) throw new Error("no meds"); return r.json(); })
  .then(data => {
    meds = data;
    subscribeDay();
  })
  .catch(err => {
    document.getElementById("statusLine").textContent = err.message;
  });
