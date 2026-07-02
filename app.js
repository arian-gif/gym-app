/* ============================================================
   Gym Tracker — vanilla JS PWA
   Data lives in localStorage (instant + offline) and is synced
   to MongoDB through the Netlify function at /api/data.
   ============================================================ */

const UNIT = "lbs";
const LS_STATE = "gym_state_v1";
const LS_DRAFT = "gym_draft_v1";
const LS_TOKEN = "gym_token";
const LS_API = "gym_api";

const API_BASE = () => localStorage.getItem(LS_API) || "/api/data";
const TOKEN = () => localStorage.getItem(LS_TOKEN) || "";

/* ---------- state ---------- */
let state = loadState();         // { sessions: [...], updatedAt: number }
let draft = loadDraft();         // in-progress session or null
let activeTab = "train";
let pushTimer = null;

function go(tab) { activeTab = tab; render(); }

const EMPTY_GOALS = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function normalizeState(s) {
  if (!s || !Array.isArray(s.sessions)) s = { sessions: [], updatedAt: 0 };
  if (!Array.isArray(s.foodLog)) s.foodLog = [];
  if (!s.goals || typeof s.goals !== "object") s.goals = { ...EMPTY_GOALS };
  return s;
}

function loadState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(LS_STATE)); } catch (e) {}
  return normalizeState(s);
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(LS_DRAFT)); } catch (e) { return null; }
}
function saveStateLocal() { localStorage.setItem(LS_STATE, JSON.stringify(state)); }
function saveDraftLocal() {
  if (draft) localStorage.setItem(LS_DRAFT, JSON.stringify(draft));
  else localStorage.removeItem(LS_DRAFT);
}

/* mutate + persist + queue cloud push */
function commit() {
  state.updatedAt = Date.now();
  saveStateLocal();
  queuePush();
}

/* ---------- cloud sync ---------- */
function setSync(text, cls) {
  const el = document.getElementById("syncStatus");
  el.textContent = text;
  el.className = "sync" + (cls ? " " + cls : "");
}

async function apiFetch(method, body) {
  const headers = { "Content-Type": "application/json" };
  const t = TOKEN();
  if (t) headers["x-app-token"] = t;
  const res = await fetch(API_BASE(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error("unauthorized"); }
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// Server rejected our password — drop it and show the login gate again.
function handleUnauthorized() {
  localStorage.removeItem(LS_TOKEN);
  setSync("…");
  showLogin("Incorrect or expired password.");
}

async function pull() {
  setSync("Syncing…", "busy");
  try {
    const remote = await apiFetch("GET");
    const rUpdated = remote && remote.updatedAt ? remote.updatedAt : 0;
    if (rUpdated > (state.updatedAt || 0)) {
      state = normalizeState({
        sessions: remote.sessions || [],
        foodLog: remote.foodLog || [],
        goals: remote.goals || { ...EMPTY_GOALS },
        updatedAt: rUpdated,
      });
      saveStateLocal();
      render();
      setSync("Synced ✓", "ok");
    } else if ((state.updatedAt || 0) > rUpdated) {
      await push();           // local is newer — upload it
    } else {
      setSync("Synced ✓", "ok");
    }
  } catch (e) {
    setSync("Offline", "err");
  }
}

function queuePush() {
  clearTimeout(pushTimer);
  setSync("Saving…", "busy");
  pushTimer = setTimeout(push, 700);
}

async function push() {
  try {
    await apiFetch("PUT", {
      sessions: state.sessions,
      foodLog: state.foodLog,
      goals: state.goals,
      updatedAt: state.updatedAt,
    });
    setSync("Synced ✓", "ok");
  } catch (e) {
    setSync("Saved on device", "err");
  }
}

/* ---------- helpers ---------- */
const todayISO = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd local
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const isUpper = (w) => w.toLowerCase().startsWith("upper");
const epley = (wt, reps) => (wt > 0 && reps > 0 ? Math.round(wt * (1 + reps / 30)) : 0);

function exKey(name, note) { return name + (note ? "|" + note : ""); }

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// most recent saved session of a given workout (excludes the live draft)
function lastSession(workout) {
  return state.sessions
    .filter((s) => s.workout === workout)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}
// previous set values for an exercise within a workout's last session
function prevSets(workout, name, note) {
  const s = lastSession(workout);
  if (!s) return null;
  const e = s.entries.find((x) => exKey(x.name, x.note) === exKey(name, note));
  return e ? e.sets : null;
}

function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 1600);
}

/* ---------- draft (active workout) ---------- */
function startWorkout(workout) {
  const template = window.WORKOUTS[workout];
  draft = {
    id: uid(),
    date: todayISO(),
    workout,
    entries: template.map((ex) => ({
      name: ex.name,
      note: ex.note || "",
      timed: !!ex.timed,
      sets: Array.from({ length: ex.sets }, () => ({ weight: "", reps: "" })),
    })),
  };
  saveDraftLocal();
  render();
}

function cancelDraft() {
  if (confirm("Discard this workout? Entered sets will be lost.")) {
    draft = null; saveDraftLocal(); render();
  }
}

function finishWorkout() {
  // strip fully-empty sets; keep entries that have at least one logged set
  const entries = draft.entries
    .map((e) => ({
      name: e.name,
      note: e.note,
      timed: !!e.timed,
      sets: e.sets
        .filter((s) => s.weight !== "" || s.reps !== "")
        .map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
    }))
    .filter((e) => e.sets.length > 0);

  if (entries.length === 0) {
    alert("Log at least one set before finishing.");
    return;
  }
  const session = { id: draft.id, date: draft.date, workout: draft.workout, entries, savedAt: Date.now() };
  // replace if editing an existing id, else add
  const i = state.sessions.findIndex((s) => s.id === session.id);
  if (i >= 0) state.sessions[i] = session; else state.sessions.push(session);
  commit();
  draft = null; saveDraftLocal();
  toast("Workout saved 💪");
  activeTab = "history";
  render();
}

/* ---------- rendering ---------- */
const view = () => document.getElementById("view");

function render() {
  document.querySelectorAll(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === activeTab)
  );
  if (activeTab === "train") renderTrain();
  else if (activeTab === "history") renderHistory();
  else if (activeTab === "progress") renderProgress();
  else if (activeTab === "food") renderFood();
  else if (activeTab === "settings") renderSettings();
  window.scrollTo(0, 0);
}

/* --- TRAIN --- */
function renderTrain() {
  document.getElementById("title").textContent = draft ? draft.workout : "Gym Tracker";
  if (!draft) {
    const cards = window.WORKOUT_ORDER.map((w) => {
      const last = lastSession(w);
      const cls = isUpper(w) ? "upper" : "lower";
      const count = window.WORKOUTS[w].length;
      const sub = last ? "Last: " + fmtDate(last.date) : count + " exercises";
      return `<button class="pick ${cls}" onclick="startWorkout('${w}')">
        <div class="big">${w}</div>
        <div class="sub">${sub}</div>
      </button>`;
    }).join("");
    view().innerHTML = `
      <div class="section-title">Start a workout</div>
      <div class="grid2">${cards}</div>
      <div class="card" style="margin-top:16px">
        <div class="row between">
          <div><div style="font-weight:700">${state.sessions.length}</div><div class="muted" style="font-size:12px">workouts logged</div></div>
          <button class="btn sm ghost" onclick="go('progress')">View progress →</button>
        </div>
      </div>`;
    return;
  }

  // active draft
  const ex = draft.entries.map((e, ei) => {
    const prev = prevSets(draft.workout, e.name, e.note);
    const setsHtml = e.sets.map((s, si) => {
      if (e.timed) {
        const p = prev && prev[si] ? `${prev[si].reps}s` : "—";
        return `<div class="setrow timed">
          <div class="lbl">Set ${si + 1}</div>
          <div class="field" style="grid-column:2 / 4">
            <input inputmode="numeric" placeholder="${prev && prev[si] ? prev[si].reps : ""}"
              value="${s.reps}" onchange="setVal(${ei},${si},'reps',this.value)" />
            <span class="unit">sec</span>
          </div>
          <button class="iconbtn" title="Remove set" onclick="removeSet(${ei},${si})">✕</button>
        </div>
        <div class="prev">prev: ${p}</div>`;
      }
      const p = prev && prev[si] ? `${prev[si].weight}×${prev[si].reps}` : "—";
      return `<div class="setrow">
        <div class="lbl">Set ${si + 1}</div>
        <div class="field">
          <input inputmode="decimal" placeholder="${prev && prev[si] ? prev[si].weight : ""}"
            value="${s.weight}" onchange="setVal(${ei},${si},'weight',this.value)" />
          <span class="unit">${UNIT}</span>
        </div>
        <div class="field">
          <input inputmode="numeric" placeholder="${prev && prev[si] ? prev[si].reps : ""}"
            value="${s.reps}" onchange="setVal(${ei},${si},'reps',this.value)" />
          <span class="unit">reps</span>
        </div>
        <button class="iconbtn" title="Remove set" onclick="removeSet(${ei},${si})">✕</button>
      </div>
      <div class="prev">prev: ${p}</div>`;
    }).join("");
    const colhead = e.timed
      ? `<div class="colhead"><span></span><span style="grid-column:2 / 4">Seconds</span><span></span></div>`
      : `<div class="colhead"><span></span><span>Weight</span><span>Reps</span><span></span></div>`;
    return `<div class="card ex">
      <h3>${e.name}</h3>
      ${e.note ? `<div class="cue">${e.note}</div>` : ""}
      ${colhead}
      ${setsHtml}
      <button class="btn sm ghost" onclick="addSet(${ei})">+ Add set</button>
    </div>`;
  }).join("");

  view().innerHTML = `
    <div class="card row between">
      <div><strong>${draft.workout}</strong><div class="muted" style="font-size:12px">${fmtDate(draft.date)}</div></div>
      <button class="btn sm danger" onclick="cancelDraft()">Discard</button>
    </div>
    ${ex}
    <button class="btn green" onclick="finishWorkout()">✓ Finish &amp; Save Workout</button>
    <div style="height:8px"></div>`;
}

function setVal(ei, si, field, val) { draft.entries[ei].sets[si][field] = val; saveDraftLocal(); }
function addSet(ei) {
  const sets = draft.entries[ei].sets;
  const last = sets[sets.length - 1];
  sets.push({ weight: last ? last.weight : "", reps: "" });
  saveDraftLocal(); render();
}
function removeSet(ei, si) { draft.entries[ei].sets.splice(si, 1); saveDraftLocal(); render(); }

/* --- HISTORY --- */
function renderHistory() {
  document.getElementById("title").textContent = "History";
  const sessions = [...state.sessions].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : (b.savedAt || 0) - (a.savedAt || 0)
  );
  if (sessions.length === 0) {
    view().innerHTML = `<div class="empty"><div class="em">📅</div>No workouts yet.<br>Go to <b>Train</b> to log your first session.</div>`;
    return;
  }
  view().innerHTML = sessions.map((s) => {
    const cls = isUpper(s.workout) ? "upper" : "lower";
    const lines = s.entries.map((e) => {
      const setStr = e.sets.map((x) => (e.timed ? `${x.reps}s` : `${x.weight}×${x.reps}`)).join(", ");
      return `<div class="row between" style="font-size:14px;margin-top:6px">
        <span>${e.name}</span><span class="muted">${setStr}</span></div>`;
    }).join("");
    return `<div class="card">
      <div class="hist-item">
        <div><span class="badge ${cls}">${s.workout}</span></div>
        <div class="muted" style="font-size:13px">${fmtDate(s.date)}</div>
      </div>
      <hr class="sep">
      ${lines}
      <div style="margin-top:10px" class="row">
        <button class="btn sm ghost" onclick="editSession('${s.id}')">Edit</button>
        <button class="btn sm danger" onclick="deleteSession('${s.id}')">Delete</button>
      </div>
    </div>`;
  }).join("");
}

function editSession(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return;
  draft = JSON.parse(JSON.stringify(s));
  // ensure string-typed inputs
  draft.entries.forEach((e) => e.sets.forEach((st) => { st.weight = String(st.weight); st.reps = String(st.reps); }));
  saveDraftLocal();
  activeTab = "train"; render();
}
function deleteSession(id) {
  if (!confirm("Delete this workout?")) return;
  state.sessions = state.sessions.filter((s) => s.id !== id);
  commit(); render(); toast("Deleted");
}

/* --- PROGRESS --- */
let chart = null;
function allExercises() {
  const set = new Map();
  state.sessions.forEach((s) =>
    s.entries.forEach((e) => set.set(exKey(e.name, e.note), { name: e.name, note: e.note, timed: !!e.timed }))
  );
  return [...set.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function renderProgress() {
  document.getElementById("title").textContent = "Progress";
  const exs = allExercises();
  if (exs.length === 0) {
    view().innerHTML = `<div class="empty"><div class="em">📈</div>No data yet.<br>Log a few workouts to see your gains.</div>`;
    return;
  }
  const saved = localStorage.getItem("gym_progress_ex");
  const current = exs.find((e) => exKey(e.name, e.note) === saved) || exs[0];
  const opts = exs.map((e) => {
    const k = exKey(e.name, e.note);
    const lbl = e.name + (e.note ? " (" + e.note + ")" : "");
    return `<option value="${k}" ${k === exKey(current.name, current.note) ? "selected" : ""}>${lbl}</option>`;
  }).join("");

  view().innerHTML = `
    <label class="fld">Exercise</label>
    <select id="exPick" onchange="onPickExercise(this.value)">${opts}</select>
    <div class="card" style="margin-top:14px">
      <div class="row" id="stats"></div>
      <div class="chartwrap"><canvas id="chart"></canvas></div>
      <div class="muted" style="font-size:11px;text-align:center;margin-top:8px">
        ${current.timed ? "Longest hold (seconds) each session." : "Estimated 1-rep max (Epley) from your best set each session."}
      </div>
    </div>`;
  drawChart(current.name, current.note, current.timed);
}

function onPickExercise(key) {
  localStorage.setItem("gym_progress_ex", key);
  const ex = allExercises().find((e) => exKey(e.name, e.note) === key);
  if (ex) drawChart(ex.name, ex.note, ex.timed);
}

function drawChart(name, note, timed) {
  const points = [];
  state.sessions
    .filter((s) => s.entries.some((e) => exKey(e.name, e.note) === exKey(name, note)))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((s) => {
      const e = s.entries.find((x) => exKey(x.name, x.note) === exKey(name, note));
      let best = 0, bestSet = null;
      e.sets.forEach((st) => {
        const v = timed ? st.reps : epley(st.weight, st.reps); // seconds for timed, est 1RM otherwise
        if (v > best) { best = v; bestSet = st; }
      });
      if (best > 0) points.push({ date: s.date, val: best, set: bestSet });
    });

  const labels = points.map((p) => fmtDate(p.date));
  const data = points.map((p) => p.val);

  // stats
  const first = points[0], last = points[points.length - 1];
  const delta = first && last ? last.val - first.val : 0;
  const best = points.reduce((m, p) => Math.max(m, p.val), 0);
  const metricLabel = timed ? "Hold (s)" : "Est 1RM";
  const bestLabel = timed ? "Best hold" : "Top weight";
  const bestVal = timed ? best + "s" : points.reduce((m, p) => Math.max(m, p.set.weight), 0);
  const curVal = timed ? (last ? last.val + "s" : "0") : (last ? last.val : 0);
  document.getElementById("stats").innerHTML = `
    <div class="stat"><div class="n">${curVal}</div><div class="l">${metricLabel}</div></div>
    <div class="stat"><div class="n" style="color:${delta >= 0 ? "var(--accent-2)" : "var(--danger)"}">${delta >= 0 ? "+" : ""}${delta}${timed ? "s" : ""}</div><div class="l">Change</div></div>
    <div class="stat"><div class="n">${bestVal}</div><div class="l">${bestLabel}</div></div>`;

  const ctx = document.getElementById("chart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data,
        borderColor: "#4cc2ff",
        backgroundColor: "rgba(76,194,255,0.12)",
        fill: true, tension: 0.25, pointRadius: 4, pointBackgroundColor: "#4cc2ff",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => {
              const p = points[c.dataIndex];
              return timed
                ? `Hold ${p.val}s`
                : `1RM ${p.val} ${UNIT}  (best ${p.set.weight}×${p.set.reps})`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: "#8b9bb0", maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: "#1b2530" } },
        y: { ticks: { color: "#8b9bb0" }, grid: { color: "#1b2530" } },
      },
    },
  });
}

/* --- NUTRITION / FOOD --- */
let foodDate = todayISO();
let foodForm = null;      // {name,kcal,protein,carbs,fat,_title,_raw} while adding
let foodResults = null;   // {loading,items,error} search panel
let foodQuery = "";
let ocrBusy = false;

const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const round1 = (x) => (x == null || isNaN(x) ? 0 : Math.round(x * 10) / 10);
const sameDay = (iso) => iso === todayISO();

function foodEntriesFor(date) { return state.foodLog.filter((f) => f.date === date); }
function foodTotals(date) {
  return foodEntriesFor(date).reduce((t, f) => ({
    kcal: t.kcal + (Number(f.kcal) || 0),
    protein: t.protein + (Number(f.protein) || 0),
    carbs: t.carbs + (Number(f.carbs) || 0),
    fat: t.fat + (Number(f.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function macroBar(label, val, goal, color) {
  const pct = goal > 0 ? Math.min(100, Math.round((val / goal) * 100)) : 0;
  return `<div class="macro">
    <div class="macro-top"><span>${label}</span><span class="muted">${Math.round(val)}${goal > 0 ? " / " + goal : ""} g</span></div>
    <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
  </div>`;
}

function changeFoodDate(delta) {
  const d = new Date(foodDate + "T00:00:00");
  d.setDate(d.getDate() + delta);
  foodDate = d.toLocaleDateString("en-CA");
  foodForm = null; foodResults = null; render();
}

function openManualFood() { foodForm = { name: "", kcal: "", protein: "", carbs: "", fat: "", _title: "Add food" }; foodResults = null; render(); }
function openFoodSearch() { foodResults = { loading: false, items: null }; foodForm = null; render(); setTimeout(() => { const el = document.getElementById("foodSearch"); if (el) el.focus(); }, 50); }
function closeFoodForm() { foodForm = null; foodResults = null; render(); }
function foodFormInput(field, val) { if (foodForm) foodForm[field] = val; }
function setFoodQuery(v) { foodQuery = v; }

function addFoodEntry() {
  if (!foodForm) return;
  const kcal = Math.round(Number(foodForm.kcal) || 0);
  if (!foodForm.name && !kcal) { alert("Enter a name or calories."); return; }
  state.foodLog.push({
    id: uid(), date: foodDate, name: (foodForm.name || "Food").trim(),
    kcal, protein: round1(Number(foodForm.protein) || 0),
    carbs: round1(Number(foodForm.carbs) || 0), fat: round1(Number(foodForm.fat) || 0),
  });
  commit();
  foodForm = null; foodResults = null;
  toast("Added ✓"); render();
}
function removeFood(id) { state.foodLog = state.foodLog.filter((f) => f.id !== id); commit(); render(); }

async function doFoodSearch() {
  const q = (foodQuery || "").trim();
  if (!q) return;
  foodResults = { loading: true, items: null }; render();
  try {
    const url = "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" +
      encodeURIComponent(q) + "&search_simple=1&action=process&json=1&page_size=20" +
      "&fields=product_name,brands,nutriments";
    const res = await fetch(url);
    const data = await res.json();
    const items = (data.products || []).map((p) => {
      const n = p.nutriments || {};
      return {
        name: [p.product_name, p.brands].filter(Boolean).join(" · ") || "Unknown",
        kcal: n["energy-kcal_100g"], protein: n.proteins_100g, carbs: n.carbohydrates_100g, fat: n.fat_100g,
      };
    }).filter((x) => x.kcal != null);
    foodResults = { loading: false, items };
  } catch (e) { foodResults = { loading: false, items: [], error: true }; }
  render();
}

function pickSearchResult(i) {
  const it = foodResults.items[i];
  foodForm = {
    name: it.name, kcal: Math.round(it.kcal || 0),
    protein: round1(it.protein), carbs: round1(it.carbs), fat: round1(it.fat),
    _title: "Add food — values per 100 g, edit to your portion",
  };
  foodResults = null; render();
}

function parseNutrition(t) {
  const s = String(t || "").replace(/\n/g, " ");
  const num = (re) => { const m = s.match(re); return m ? parseFloat(m[m.length - 1]) : null; };
  return {
    kcal: num(/calories?\s*[:\-]?\s*([0-9]{1,4})/i) || num(/energy[^0-9]*([0-9]{2,4})\s*k?cal/i),
    protein: num(/protein\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*g/i),
    carbs: num(/(?:total\s+)?carbohydrate?s?\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*g/i),
    fat: num(/(?:total\s+)?fat\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*g/i),
  };
}

async function handleOcr(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  if (!window.Tesseract) { alert("OCR engine is still loading — try again in a moment."); return; }
  ocrBusy = true; foodForm = null; foodResults = null; render();
  try {
    const { data } = await Tesseract.recognize(file, "eng", {
      logger: (m) => { if (m.status === "recognizing text") setSync("OCR " + Math.round(m.progress * 100) + "%", "busy"); },
    });
    const p = parseNutrition(data.text);
    foodForm = {
      name: "", kcal: p.kcal || "", protein: p.protein || "", carbs: p.carbs || "", fat: p.fat || "",
      _title: "Add food — from photo, check the values", _raw: (data.text || "").trim(),
    };
    setSync("Synced ✓", "ok");
  } catch (e) { alert("Couldn't read that image. Try a clearer, closer photo of the label."); setSync("Synced ✓", "ok"); }
  ocrBusy = false; render();
}

function renderFoodForm() {
  const f = foodForm;
  const mi = (label, field, mode) =>
    `<div><label class="fld">${label}</label><input class="input" inputmode="${mode}" value="${escapeHtml(f[field])}" oninput="foodFormInput('${field}',this.value)" /></div>`;
  return `<div class="card">
    <div class="section-title" style="margin:0 0 8px">${escapeHtml(f._title || "Add food")}</div>
    <label class="fld">Name</label>
    <input class="input" value="${escapeHtml(f.name)}" oninput="foodFormInput('name',this.value)" placeholder="e.g. Chicken &amp; rice" />
    <div class="macro-inputs">
      ${mi("Calories", "kcal", "numeric")}
      ${mi("Protein (g)", "protein", "decimal")}
      ${mi("Carbs (g)", "carbs", "decimal")}
      ${mi("Fat (g)", "fat", "decimal")}
    </div>
    ${f._raw ? `<details style="margin-top:10px"><summary class="muted" style="font-size:12px">Show OCR text</summary><pre class="ocr-raw">${escapeHtml(f._raw)}</pre></details>` : ""}
    <div style="height:12px"></div>
    <button class="btn green" onclick="addFoodEntry()">Add to ${sameDay(foodDate) ? "today" : fmtDate(foodDate)}</button>
    <div style="height:8px"></div>
    <button class="btn ghost" onclick="closeFoodForm()">Cancel</button>
  </div>`;
}

function renderSearchPanel() {
  const r = foodResults;
  let body = "";
  if (r.loading) body = `<div class="muted">Searching…</div>`;
  else if (r.error) body = `<div class="muted">Search failed — check your connection.</div>`;
  else if (r.items && r.items.length === 0) body = `<div class="muted">No results.</div>`;
  else if (r.items) body = r.items.map((it, i) => `<button class="result" onclick="pickSearchResult(${i})">
      <div style="font-weight:600">${escapeHtml(it.name)}</div>
      <div class="muted" style="font-size:12px">${Math.round(it.kcal)} kcal · ${round1(it.protein)}p ${round1(it.carbs)}c ${round1(it.fat)}f <span style="opacity:.6">/100 g</span></div>
    </button>`).join("");
  return `<div class="card">
    <div class="row" style="gap:8px">
      <input class="input" id="foodSearch" value="${escapeHtml(foodQuery)}" placeholder="Search foods…" enterkeyhint="search"
        oninput="setFoodQuery(this.value)" onkeydown="if(event.key==='Enter')doFoodSearch()" />
      <button class="btn primary" style="width:auto;padding:12px 16px" onclick="doFoodSearch()">Go</button>
    </div>
    <div class="muted" style="font-size:11px;margin-top:6px">Powered by Open Food Facts (free).</div>
    <div style="height:10px"></div>
    ${body}
    <div style="height:10px"></div>
    <button class="btn ghost sm" onclick="closeFoodForm()">Close</button>
  </div>`;
}

function renderFood() {
  document.getElementById("title").textContent = "Nutrition";
  const g = state.goals || EMPTY_GOALS;
  const t = foodTotals(foodDate);
  const kcalGoal = Number(g.calories) || 0;
  const remaining = kcalGoal ? kcalGoal - Math.round(t.kcal) : null;
  const pct = kcalGoal ? Math.min(100, Math.round((t.kcal / kcalGoal) * 100)) : 0;
  const entries = foodEntriesFor(foodDate).slice().reverse();

  const summary = `<div class="card">
    <div class="row between">
      <button class="iconbtn" onclick="changeFoodDate(-1)">◀</button>
      <strong>${sameDay(foodDate) ? "Today" : fmtDate(foodDate)}</strong>
      <button class="iconbtn" onclick="changeFoodDate(1)" ${sameDay(foodDate) ? 'disabled style="opacity:.25"' : ""}>▶</button>
    </div>
    <div class="cal-summary">
      <div class="cal-num">${Math.round(t.kcal)}</div>
      <div class="cal-sub">${kcalGoal ? "of " + kcalGoal + " kcal" : "kcal"}</div>
    </div>
    ${kcalGoal ? `<div class="bar big"><div class="bar-fill" style="width:${pct}%;background:${remaining < 0 ? "var(--danger)" : "var(--accent)"}"></div></div>
      <div class="muted" style="text-align:center;font-size:12px;margin-top:6px">${remaining >= 0 ? remaining + " kcal left" : (-remaining) + " kcal over"}</div>` : ""}
    <div style="height:14px"></div>
    ${macroBar("Protein", t.protein, Number(g.protein) || 0, "var(--accent-2)")}
    ${macroBar("Carbs", t.carbs, Number(g.carbs) || 0, "#f0b64c")}
    ${macroBar("Fat", t.fat, Number(g.fat) || 0, "#f87171")}
    ${kcalGoal ? "" : `<div class="muted" style="font-size:12px;margin-top:6px">Set a daily goal in <b>Settings</b> to see targets.</div>`}
  </div>`;

  const actions = `<div class="grid3">
    <label class="btn ghost foodbtn">📷 Scan<input type="file" accept="image/*" style="display:none" onchange="handleOcr(event)" /></label>
    <button class="btn ghost" onclick="openFoodSearch()">🔍 Search</button>
    <button class="btn ghost" onclick="openManualFood()">✏️ Manual</button>
  </div>`;

  let panel = "";
  if (ocrBusy) panel = `<div class="card"><div class="row" style="gap:12px"><div class="spinner"></div><div style="font-size:14px">Reading image… the first scan downloads the OCR engine (a few MB), so give it a moment.</div></div></div>`;
  else if (foodForm) panel = renderFoodForm();
  else if (foodResults) panel = renderSearchPanel();

  const list = entries.length
    ? entries.map((f) => `<div class="card food-item">
        <div class="row between">
          <div style="min-width:0">
            <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis">${escapeHtml(f.name)}</div>
            <div class="muted" style="font-size:12px">${f.protein || 0}p · ${f.carbs || 0}c · ${f.fat || 0}f</div>
          </div>
          <div class="row" style="gap:12px">
            <div style="font-weight:800;white-space:nowrap">${f.kcal}<span class="muted" style="font-weight:400;font-size:11px"> kcal</span></div>
            <button class="iconbtn" title="Remove" onclick="removeFood('${f.id}')">✕</button>
          </div>
        </div>
      </div>`).join("")
    : `<div class="empty"><div class="em">🍎</div>Nothing logged ${sameDay(foodDate) ? "today" : "this day"} yet.<br>Use Scan, Search, or Manual above.</div>`;

  view().innerHTML = summary + actions + panel + `<div class="section-title">Logged</div>` + list;
}

/* --- SETTINGS --- */
function renderSettings() {
  document.getElementById("title").textContent = "Settings";
  view().innerHTML = `
    <div class="card">
      <div class="section-title" style="margin:0 0 8px">Cloud sync (MongoDB)</div>
      <label class="fld">API endpoint</label>
      <input class="input" id="apiInput" value="${API_BASE()}" placeholder="/api/data" />
      <div style="height:12px"></div>
      <button class="btn primary" onclick="saveSettings()">Save &amp; sync now</button>
      <div style="height:8px"></div>
      <button class="btn ghost" onclick="pull()">Pull from cloud</button>
    </div>

    <div class="card">
      <div class="section-title" style="margin:0 0 8px">Daily nutrition goals</div>
      <div class="macro-inputs">
        <div><label class="fld">Calories</label><input class="input" id="goalCal" inputmode="numeric" value="${state.goals.calories || ""}" placeholder="e.g. 2600" /></div>
        <div><label class="fld">Protein (g)</label><input class="input" id="goalPro" inputmode="numeric" value="${state.goals.protein || ""}" placeholder="e.g. 180" /></div>
        <div><label class="fld">Carbs (g)</label><input class="input" id="goalCarb" inputmode="numeric" value="${state.goals.carbs || ""}" placeholder="e.g. 300" /></div>
        <div><label class="fld">Fat (g)</label><input class="input" id="goalFat" inputmode="numeric" value="${state.goals.fat || ""}" placeholder="e.g. 80" /></div>
      </div>
      <div style="height:12px"></div>
      <button class="btn primary" onclick="saveGoals()">Save goals</button>
    </div>

    <div class="card">
      <div class="section-title" style="margin:0 0 8px">Account</div>
      <button class="btn danger" onclick="logout()">Log out</button>
    </div>

    <div class="card">
      <div class="section-title" style="margin:0 0 8px">Backup</div>
      <button class="btn ghost" onclick="exportData()">⬇️ Export data (JSON)</button>
      <div style="height:8px"></div>
      <label class="btn ghost" style="cursor:pointer">⬆️ Import data
        <input type="file" accept="application/json" style="display:none" onchange="importData(event)" />
      </label>
    </div>

    <div class="card">
      <div class="muted" style="font-size:13px">
        ${state.sessions.length} workouts stored on this device.<br>
        Last change: ${state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "—"}
      </div>
    </div>`;
}

function saveSettings() {
  localStorage.setItem(LS_API, document.getElementById("apiInput").value.trim() || "/api/data");
  toast("Settings saved");
  pull();
}

function saveGoals() {
  state.goals = {
    calories: Math.round(Number(document.getElementById("goalCal").value) || 0),
    protein: Math.round(Number(document.getElementById("goalPro").value) || 0),
    carbs: Math.round(Number(document.getElementById("goalCarb").value) || 0),
    fat: Math.round(Number(document.getElementById("goalFat").value) || 0),
  };
  commit();
  toast("Goals saved");
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "gym-backup-" + todayISO() + ".json";
  a.click();
}
function importData(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.sessions)) throw new Error();
      state = normalizeState({ ...data, updatedAt: Date.now() });
      saveStateLocal(); queuePush(); render(); toast("Imported ✓");
    } catch (e) { alert("Invalid backup file."); }
  };
  reader.readAsText(file);
}

/* ---------- tabs / boot ---------- */
document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => { activeTab = b.dataset.tab; render(); })
);

// fix emoji-in-tab markup (span around icon) for nicer styling
document.querySelectorAll(".tab").forEach((b) => {
  const parts = b.textContent.trim().split(" ");
  b.innerHTML = `<span>${parts[0]}</span>${parts.slice(1).join(" ")}`;
});

/* ---------- login gate ---------- */
function showLogin(errMsg) {
  let el = document.getElementById("login");
  if (!el) { el = document.createElement("div"); el.id = "login"; document.body.appendChild(el); }
  el.innerHTML = `
    <div class="login-card">
      <img src="icon.svg" class="login-icon" alt="" />
      <h2>Gym Tracker</h2>
      <p class="muted">Enter your password to continue</p>
      <input id="loginPw" class="input" type="password" autocomplete="current-password"
        enterkeyhint="go" placeholder="Password" />
      <div id="loginErr" class="login-err">${errMsg || ""}</div>
      <button class="btn primary" id="loginBtn">Log in</button>
      <div class="muted" style="font-size:11px;margin-top:16px">
        Your password is the <b>APP_TOKEN</b> you set in Netlify.
      </div>
    </div>`;
  el.style.display = "flex";
  const pw = document.getElementById("loginPw");
  document.getElementById("loginBtn").onclick = doLogin;
  pw.onkeydown = (e) => { if (e.key === "Enter") doLogin(); };
  setTimeout(() => pw.focus(), 50);
}

function hideLogin() {
  const el = document.getElementById("login");
  if (el) el.style.display = "none";
}

async function doLogin() {
  const pwEl = document.getElementById("loginPw");
  const errEl = document.getElementById("loginErr");
  const btn = document.getElementById("loginBtn");
  const pw = pwEl.value;
  if (!pw) { errEl.textContent = "Enter your password."; return; }

  btn.disabled = true; btn.textContent = "Checking…";
  localStorage.setItem(LS_TOKEN, pw); // apiFetch reads it from here

  try {
    const res = await fetch(API_BASE(), { headers: { "x-app-token": pw } });
    if (res.status === 401) {
      localStorage.removeItem(LS_TOKEN);
      btn.disabled = false; btn.textContent = "Log in";
      errEl.textContent = "Incorrect password.";
      pwEl.value = ""; pwEl.focus();
      return;
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    hideLogin();
    bootApp();
  } catch (e) {
    // Can't reach the server. Allow in only if this device already has data (offline use).
    if ((loadState().sessions || []).length > 0) { hideLogin(); bootApp(); }
    else {
      localStorage.removeItem(LS_TOKEN);
      btn.disabled = false; btn.textContent = "Log in";
      errEl.textContent = "Can't reach server — check your connection.";
    }
  }
}

function logout() {
  localStorage.removeItem(LS_TOKEN);
  location.reload();
}

/* ---------- boot ---------- */
function bootApp() {
  if (draft) activeTab = "train";
  render();
  pull();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

if (TOKEN()) bootApp();   // already logged in on this device
else showLogin();         // first launch (or after logout) -> gate

// expose handlers used in inline onclick attributes
Object.assign(window, {
  startWorkout, cancelDraft, finishWorkout, setVal, addSet, removeSet,
  editSession, deleteSession, onPickExercise, saveSettings, exportData, importData,
  pull, go, render, logout, showLogin, doLogin,
  // nutrition
  changeFoodDate, openManualFood, openFoodSearch, closeFoodForm, foodFormInput,
  setFoodQuery, addFoodEntry, removeFood, doFoodSearch, pickSearchResult, handleOcr, saveGoals,
});
