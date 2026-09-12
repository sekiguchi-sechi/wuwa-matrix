/* 生成物: src/js/*.js を build.py が連結したもの。編集は src/ 側で行う */
(function () {
"use strict";
/* ==== 00-const.js ==== */
/* ---------- 定数 ---------- */
const TEAM_SIZE = 3;          // 1チームの人数
const INITIAL_TEAMS = 5;      // 初期・リセット後のチーム数（上限なし）
const ATTRS = ["回折", "気動", "凝縮", "消滅", "焦熱", "電導", "物理"];
const NAME_MAX = 20, MEMO_MAX = 120;
const TOAST_MS = 1800, TOAST_UNDO_MS = 7000;
const DRAG_DELAY = 120;       // タッチ時の長押し判定(ms)
const DRAG_ANIM = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 150;
// localStorage / sessionStorage のキー（dm = Demise Matrix）
const LS = { state: "dm_state", enemyClosed: "dm_enemy_closed", theme: "dm_theme" };
const SS = { tab: "dm_tab", banner: "dm_banner_dismissed" };

/* ==== 10-util.js ==== */
/* ---------- 汎用ユーティリティ ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "t" + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, "0");
/** 端末ローカルの今日 (YYYY-MM-DD)。ゲーム内の期間境界は05:00だが、日単位の判定で十分とみなす */
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
/** 表記揺れ吸収用: 「・」「()」「（）」空白を除去 */
const norm = s => String(s || "").replace(/[・()（）\s]/g, "");

/** 保存領域の安全な読み書き（プライベートモード等で例外になるため try で包む） */
function storeGet(store, key) { try { return JSON.parse(store.getItem(key) || "null"); } catch (e) { return null; } }
function storeSet(store, key, value) { try { store.setItem(key, JSON.stringify(value)); } catch (e) { /* 保存不可の環境では無視 */ } }
const lsGet = k => storeGet(localStorage, k), lsSet = (k, v) => storeSet(localStorage, k, v);
const ssGet = k => storeGet(sessionStorage, k), ssSet = (k, v) => storeSet(sessionStorage, k, v);

/* ==== 20-data.js ==== */
/* ---------- マスタデータ（data.js が window.__DATA__ に注入） ---------- */
const DATA = window.__DATA__ || { characters: [], periods: [] };
const CHARACTERS = Array.isArray(DATA.characters) ? DATA.characters : [];
/** 期間は開始日の降順（新しい順）。start が無いものは末尾 */
const PERIODS = (Array.isArray(DATA.periods) ? DATA.periods.slice() : [])
  .sort((a, b) => (b.start || "").localeCompare(a.start || ""));
const CHAR_BY_ID = new Map(CHARACTERS.map(c => [c.id, c]));

const charById = id => CHAR_BY_ID.get(id);
const periodById = id => PERIODS.find(p => p.id === id);
/** 名前・id・別表記・表記揺れのいずれかで一致するか */
const nameMatch = (c, n) => c.id === n || c.name === n || norm(c.name) === norm(n) || (c.aliases || []).some(a => norm(a) === norm(n));
const inList = (c, arr) => (arr || []).some(n => nameMatch(c, n));

/** 今日が開催期間に含まれる期（複数あれば開始日が最新のもの） */
function periodByDate() {
  const today = todayStr();
  return PERIODS.find(p => p.start && p.start <= today && (!p.end || today <= p.end)) || null;
}
/** 初期表示に使う期間ID: 開催中 > data.json の defaultPeriod > 先頭 */
const defaultPeriodId = () => periodByDate()?.id || (periodById(DATA.defaultPeriod) && DATA.defaultPeriod) || PERIODS[0]?.id || "";

/* ==== 30-state.js ==== */
/* ---------- 状態（localStorage にのみ保存。サーバーには何も送らない） ---------- */
const state = {
  period: "",            // 表示中の期間ID
  owned: [],             // 所持キャラID（空 = 未登録扱いで全キャラ表示）
  plans: {},             // { [periodId]: { teams: [...] } } 期間ごとの編成
  activeTeam: null,      // クリック追加の対象チームID（非永続）
  ui: { showAll: false, showUpcoming: false },
};

function normTeam(t) {
  return { id: t.id || uid(), name: t.name || "", memo: t.memo || "", members: Array.isArray(t.members) ? t.members.slice() : [] };
}
const newTeams = n => Array.from({ length: n }, () => normTeam({}));

/** 表示中の期間の編成（無ければ作る） */
function plan() {
  let p = state.plans[state.period];
  if (!p || !Array.isArray(p.teams)) p = state.plans[state.period] = { teams: newTeams(INITIAL_TEAMS) };
  return p;
}
const teams = () => plan().teams;
const teamById = id => teams().find(t => t.id === id);
const teamLabel = (t, i) => t.name || `チーム ${i + 1}`;

const period = () => periodById(state.period) || PERIODS[0] || null;
const maxDeploy = c => inList(c, period()?.twice) ? 2 : 1;
const isOwned = id => !state.owned.length || state.owned.includes(id);
const usedCount = id => teams().reduce((n, t) => n + (t.members.includes(id) ? 1 : 0), 0);
const isOver = c => usedCount(c.id) > maxDeploy(c);

/* --- 永続化 --- */
function stateDoc() { return { v: 3, period: state.period, owned: state.owned, plans: state.plans, ui: state.ui }; }
function hydrate(d) {
  if (!d || typeof d !== "object") return;
  if (d.period) state.period = d.period;
  if (Array.isArray(d.owned)) state.owned = d.owned.filter(id => CHAR_BY_ID.has(id));
  if (d.plans && typeof d.plans === "object") {
    state.plans = {};
    for (const k in d.plans) state.plans[k] = { teams: (d.plans[k].teams || []).map(normTeam) };
  }
  if (d.ui && typeof d.ui === "object") state.ui = { ...state.ui, showAll: !!d.ui.showAll, showUpcoming: !!d.ui.showUpcoming };
}
function loadState() {
  hydrate(lsGet(LS.state));
  // 保存されていた期間がマスタから消えていたら、開催中の期間へ
  if (!periodById(state.period)) state.period = defaultPeriodId();
}
const saveState = () => lsSet(LS.state, stateDoc());

/* --- 1手戻す（直前のスナップショットを閉包に捕まえるので、後続操作に影響されない） --- */
let undoSnap = null;
function pushUndo() { undoSnap = { plans: clone(state.plans), period: state.period }; }
function undoAction() {
  const snap = undoSnap;
  return { label: "元に戻す", fn: () => { if (!snap) return; state.plans = snap.plans; state.period = snap.period; undoSnap = null; commit(); toast("元に戻しました"); } };
}

/* --- チーム操作 --- */
/**
 * team に id を入れられるか。opts.quiet=true なら理由をトーストしない。
 * opts.from はドラッグ元チーム（同一キャラの移動時は使用回数から1を引く）。
 */
function canAdd(team, id, opts = {}) {
  const c = charById(id);
  if (!c || !team) return false;
  const say = m => { if (!opts.quiet) toast(m); return false; };
  if (c.upcoming && !state.ui.showUpcoming) return say(`${c.name} は未実装です（「未実装も表示」をオンにすると編成できます）`);
  if (!isOwned(id)) return say(`${c.name} は未所持です（所持キャラ登録で追加）`);
  if (team.members.includes(id)) return say(`${c.name} はこのチームに既にいます`);
  if (team.members.length >= TEAM_SIZE) return say(`このチームは満員です（最大${TEAM_SIZE}人）`);
  let used = usedCount(id);
  if (opts.from && opts.from.members.includes(id)) used--;
  if (used >= maxDeploy(c)) return say(`${c.name} は出撃回数の上限（${maxDeploy(c)}回）です`);
  return true;
}
function addToTeam(team, id, index, opts) {
  if (!canAdd(team, id, opts)) return false;
  if (index == null || index > team.members.length) team.members.push(id); else team.members.splice(index, 0, id);
  return true;
}
/** クリック追加の行き先: アクティブなチーム → 入れられる最初のチーム → null */
function pickTeamFor(id) {
  const act = teamById(state.activeTeam);
  if (act && canAdd(act, id, { quiet: true })) return act;
  return teams().find(t => canAdd(t, id, { quiet: true })) || null;
}
/** 状態を保存して再描画（描画は次のタスクで行い、Sortable のドロップ処理と衝突させない） */
function commit() { saveState(); scheduleRender(); }

/* ==== 40-render.js ==== */
/* ---------- 描画 ----------
   renderAll(): ヘッダー・バナー・配置エリア・キャラ一覧（状態が変わるたび）
   renderEnemies(): 敵情報（期間が変わったときだけ。<details> の開閉を保つため） */
let renderTimer = null;
function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(renderAll, 0); }

function toast(msg, action) {
  const t = $("#toast"), b = $("#toast-act");
  $("#toast-msg").textContent = msg;
  b.hidden = !action; b.onclick = null;
  if (action) { b.textContent = action.label; b.onclick = () => { t.classList.remove("show"); action.fn(); }; }
  t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), action ? TOAST_UNDO_MS : TOAST_MS);
}

function cardHtml(c, opts = {}) {
  const attr = ATTRS.includes(c.attr) ? c.attr : "物理";
  const icon = c.icon ? `<img class="ic" src="${esc(c.icon)}" alt="" loading="lazy" draggable="false">` : `<div class="ic txt">${esc(c.name.slice(0, 1))}</div>`;
  let dep = "", badge = "", depText = "";
  if (opts.dep) {
    const mx = maxDeploy(c), left = Math.max(0, mx - usedCount(c.id));
    depText = `、出撃可能 ${left}/${mx}`;
    dep = `<span class="dep" aria-hidden="true">${Array.from({ length: mx }, (_, i) => `<i class="${i < left ? "on" : ""}"></i>`).join("")}</span>`;
  }
  const over = opts.over && isOver(c);
  if (over) badge = `<span class="badge">超過</span>`; else if (c.upcoming) badge = `<span class="badge">未実装</span>`;
  const cls = ["card", opts.cls || "", over ? "over" : ""].join(" ").trim();
  const label = `${c.name}、${attr}、★${c.rank}${c.upcoming ? "、未実装" : ""}${depText}${over ? "、出撃回数超過" : ""}`;
  return `<div class="${cls}" data-id="${esc(c.id)}" style="--ecol:var(--e-${attr})" role="button" tabindex="0" aria-label="${esc(label)}" title="${esc(label)}">
    <span class="rk" aria-hidden="true">★${esc(c.rank)}</span>${dep}${icon}${badge}<span class="nm">${esc(c.name)}</span></div>`;
}

function renderHeader() {
  const p = period();
  $("#hdr-ver").textContent = p ? `${p.label} ${p.ver}` : "";
  const over = CHARACTERS.filter(isOver).length;
  $("#stat").innerHTML = over ? `<span class="warn-n">出撃回数の超過 ${over}人</span>` : "";
  $("#team-count").textContent = `${teams().length}チーム`;
}

function renderBanner() {
  const b = $("#banner"), cur = periodByDate();
  const dismissed = ssGet(SS.banner) === (cur && cur.id);
  if (!cur || cur.id === state.period || dismissed) { b.innerHTML = ""; return; }
  b.innerHTML = `<div class="banner">本日は <b>${esc(cur.label)} ${esc(cur.ver)}</b> の開催期間です。<button class="small primary" data-switch="${esc(cur.id)}">切り替える</button><button class="small ghost" data-dismiss>今はしない</button></div>`;
}

function renderTeams() {
  const ts = teams();
  if (state.activeTeam && !ts.find(t => t.id === state.activeTeam)) state.activeTeam = null;
  $("#teams").innerHTML = ts.map((t, i) => `
    <div class="team${t.id === state.activeTeam ? " active" : ""}" data-tid="${esc(t.id)}" aria-current="${t.id === state.activeTeam}">
      <span class="grip" title="ドラッグで並べ替え" aria-label="並べ替え">⋮⋮</span>
      <div class="tbody">
        <div class="trow">
          <span class="tno">${i + 1}</span>
          <input type="text" class="tname" value="${esc(t.name)}" placeholder="チーム ${i + 1}" aria-label="チーム名" maxlength="${NAME_MAX}">
          <button class="small" data-act="clear" title="このチームを空にする" ${t.members.length ? "" : "disabled"}>空にする</button>
        </div>
        <div class="slots" data-tid="${esc(t.id)}">
          ${t.members.map(id => { const c = charById(id); return c ? cardHtml(c, { over: true }) : `<div class="slot">不明: ${esc(id)}</div>`; }).join("")}
          ${Array.from({ length: Math.max(0, TEAM_SIZE - t.members.length) }, () => `<div class="slot">空き</div>`).join("")}
        </div>
        <input type="text" class="tmemo" value="${esc(t.memo)}" placeholder="メモ（ローテ順・狙いなど）" aria-label="メモ" maxlength="${MEMO_MAX}">
      </div>
    </div>`).join("");
  initSlotSortables();
}

function renderRoster() {
  const showAll = state.ui.showAll || !state.owned.length;
  const list = CHARACTERS.filter(c => (showAll || state.owned.includes(c.id)) && (state.ui.showUpcoming || !c.upcoming));
  const hint = state.owned.length ? "" : `<div class="empty" style="grid-column:1/-1;padding:6px 8px">所持キャラが未登録のため全キャラを表示中。「所持キャラ登録」で絞り込めます。</div>`;
  $("#roster").innerHTML = hint + list.map(c => cardHtml(c, {
    dep: true, over: true,
    cls: (usedCount(c.id) >= maxDeploy(c) ? "used" : "") + (isOwned(c.id) ? "" : " notown"),
  })).join("");
}

/** 敵の効果文: 「Nラウンド目で有効化」行と <…> のタグ名を強調 */
function fmtDesc(d) {
  return esc(d)
    .replace(/^(\d+ラウンド目で有効化)$/gm, '<span class="rd">$1</span>')
    .replace(/(&lt;[\s\S]*?&gt;)/g, '<span class="tg">$1</span>');
}

function renderEnemies() {
  $("#period-sel").innerHTML = PERIODS.map(p => `<option value="${esc(p.id)}"${p.id === state.period ? " selected" : ""}>${esc(p.label)} ${esc(p.ver)}${p.verified === false ? " (要確認)" : ""}</option>`).join("");
  const p = period(), b = $("#enemy-body");
  if (!p) { b.innerHTML = `<div class="empty">開催期間データがありません</div>`; return; }
  const chips = arr => arr && arr.length ? arr.map(n => `<span class="chip">${esc(n)}</span>`).join("") : `<span class="chip">—</span>`;
  b.innerHTML = `
    ${p.verified === false ? `<div class="warn"><b>要確認</b>未確認の情報を含みます。ゲーム内の表示を優先してください。</div>` : ""}
    <div class="meta">
      <span>期間</span><b>${esc(p.dates || "—")}</b>
      <span>クライシス担当</span><b class="chips">${chips(p.crisis)}</b>
      <span>2回出撃可</span><b class="chips">${chips(p.twice)}</b>
    </div>
    ${p.circuits && p.circuits.length ? `<details class="circ"><summary>増幅回路（${p.circuits.length}）</summary>${p.circuits.map(c => `<div class="ci"><b>${esc(c.name)}</b>${esc(c.text)}</div>`).join("")}</details>` : ""}
    ${(p.enemies || []).map(e => `<div class="enemy" style="--ecol:var(--e-${ATTRS.includes(e.attr) ? e.attr : "物理"})">
        ${e.icon ? `<img src="${esc(e.icon)}" alt="">` : ""}
        <div class="en"><span class="ech">${esc(e.attr)}</span>${esc(e.name)}</div>
        <div class="ed">${fmtDesc(e.desc || "")}</div>
      </div>`).join("")}
    ${!(p.enemies || []).length ? `<div class="empty">この期間の敵情報は未登録です</div>` : ""}
    ${p.note ? `<div class="note">${esc(p.note)}</div>` : ""}`;
}

function renderAll() { renderHeader(); renderBanner(); renderTeams(); renderRoster(); }
/** 期間が変わったときに呼ぶ（編成・敵情報とも切り替わる） */
function changePeriod(id) {
  if (!periodById(id)) return;
  state.period = id; state.activeTeam = null;
  commit(); renderEnemies();
}

/* ==== 50-dnd.js ==== */
/* ---------- ドラッグ＆ドロップ（SortableJS） ----------
   #teams と #roster のコンテナは差し替わらないので起動時に1回だけ生成。
   各チームの .slots は描画のたびに作り直されるので renderTeams から再生成する。 */
let slotSortables = [];

function initContainerSortables() {
  // チームの並べ替え（左端の ⋮⋮ をつかむ）
  new Sortable($("#teams"), {
    handle: ".grip", draggable: ".team", animation: DRAG_ANIM, ghostClass: "sortable-ghost",
    onEnd: ev => {
      if (ev.oldIndex === ev.newIndex) return;
      const ts = teams(); const [t] = ts.splice(ev.oldIndex, 1); ts.splice(ev.newIndex, 0, t); commit();
    },
  });
  // キャラ一覧: 複製してチームへ。チームからここへ落とすと外す
  new Sortable($("#roster"), {
    group: { name: "cards", pull: "clone", put: true }, sort: false, draggable: ".card",
    animation: DRAG_ANIM, ghostClass: "sortable-ghost", delay: DRAG_DELAY, delayOnTouchOnly: true,
    onAdd: ev => {
      const from = teamById(ev.from.dataset.tid);
      if (from) { const i = from.members.indexOf(ev.item.dataset.id); if (i >= 0) from.members.splice(i, 1); }
      ev.item.remove(); commit();
    },
  });
}

function initSlotSortables() {
  slotSortables.forEach(s => { try { s.destroy(); } catch (e) { /* 既にDOMごと消えている */ } });
  slotSortables = $$(".team .slots").map(el => new Sortable(el, {
    group: {
      name: "cards", pull: true,
      // ドラッグ中に受け入れ可否を判定（満員・重複・出撃上限なら落とせない）
      put: (to, from, dragEl) => canAdd(teamById(to.el.dataset.tid), dragEl.dataset.id, { quiet: true, from: teamById(from.el.dataset.tid) }),
    },
    draggable: ".card", filter: ".slot", animation: DRAG_ANIM, ghostClass: "sortable-ghost", delay: DRAG_DELAY, delayOnTouchOnly: true,
    onAdd: ev => {
      const to = teamById(ev.to.dataset.tid), from = teamById(ev.from.dataset.tid), id = ev.item.dataset.id;
      if (from) { const i = from.members.indexOf(id); if (i >= 0) from.members.splice(i, 1); }
      // .slot(空き枠) も同じコンテナにいるため newIndex は人数を超えうる → 末尾に丸める
      addToTeam(to, id, Math.min(ev.newIndex, to.members.length));
      commit();
    },
    onUpdate: ev => {
      const t = teamById(ev.to.dataset.tid); const [m] = t.members.splice(ev.oldIndex, 1);
      t.members.splice(Math.min(ev.newIndex, t.members.length), 0, m); commit();
    },
  }));
}

/* ==== 60-modals.js ==== */
/* ---------- モーダル ---------- */
let modalReturnFocus = null;
function openModal(title, body, footer) {
  modalReturnFocus = document.activeElement;
  $("#modal-root").innerHTML = `<div class="modal" id="modal"><div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="mh"><h3>${esc(title)}</h3><span class="sp"></span><button class="ghost" data-close>閉じる</button></div>
    <div class="mb">${body}</div>${footer ? `<div class="mf">${footer}</div>` : ""}</div></div>`;
  const m = $("#modal");
  m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", modalKeys);
  (m.querySelector(".mf .primary") || m.querySelector("[data-close]")).focus();
  return m;
}
function modalKeys(e) {
  if (e.key === "Escape") { closeModal(); return; }
  if (e.key !== "Tab") return;
  // フォーカスをモーダル内に留める
  const f = $$("#modal button:not([hidden]), #modal input, #modal select, #modal textarea, #modal a[href], #modal [tabindex='0']").filter(el => !el.disabled);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
}
function closeModal() {
  $("#modal-root").innerHTML = "";
  document.removeEventListener("keydown", modalKeys);
  if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus();
  modalReturnFocus = null;
}

/* --- 所持キャラ登録 --- */
function openOwnedModal() {
  const draft = new Set(state.owned);
  const grid = rank => CHARACTERS.filter(c => c.rank === rank).map(c => cardHtml(c, { cls: draft.has(c.id) ? "own" : "" })).join("");
  const m = openModal("所持キャラ登録", `
    <div class="kv" style="margin-bottom:8px;color:var(--muted)">タップで所持／未所持を切り替え。<span id="own-n"></span></div>
    <div class="sec">★5</div><div class="ownergrid">${grid(5)}</div>
    <div class="sec">★4</div><div class="ownergrid">${grid(4)}</div>`,
    `<button data-all="1">全て所持</button><button data-all="0">全て解除</button><span class="sp"></span><button class="primary" data-save>保存</button>`);
  const upd = () => { $("#own-n", m).textContent = `所持 ${draft.size} / ${CHARACTERS.length}`; };
  upd();
  m.addEventListener("click", e => {
    const card = e.target.closest(".ownergrid .card");
    if (card) { const id = card.dataset.id; draft.has(id) ? draft.delete(id) : draft.add(id); card.classList.toggle("own", draft.has(id)); upd(); return; }
    const all = e.target.closest("[data-all]");
    if (all) {
      if (all.dataset.all === "1") CHARACTERS.forEach(c => draft.add(c.id)); else draft.clear();
      $$(".ownergrid .card", m).forEach(el => el.classList.toggle("own", draft.has(el.dataset.id))); upd(); return;
    }
    if (e.target.closest("[data-save]")) {
      state.owned = CHARACTERS.filter(c => draft.has(c.id)).map(c => c.id);
      closeModal(); commit(); toast(`所持キャラを保存しました（${state.owned.length}人）`);
    }
  });
}

/* --- 画像で保存（html2canvas は押したときだけ読み込む） --- */
let html2canvasLoading = null;
function loadHtml2canvas() {
  if (window.html2canvas) return Promise.resolve();
  if (!html2canvasLoading) html2canvasLoading = new Promise((ok, ng) => {
    const s = document.createElement("script"); s.src = "vendor/html2canvas.min.js";
    s.onload = ok; s.onerror = () => { html2canvasLoading = null; ng(new Error("html2canvas の読み込みに失敗")); };
    document.head.appendChild(s);
  });
  return html2canvasLoading;
}
async function saveAsImage() {
  const el = $("#teams");
  if (!el.children.length) { toast("チームがありません"); return; }
  if ($("#wrap").dataset.tab !== "teams") setTab("teams");   // 非表示のパネルは描画できない
  toast("画像を生成中…");
  try {
    await loadHtml2canvas();
    const canvas = await html2canvas(el, { backgroundColor: getComputedStyle(document.body).backgroundColor, scale: 2, useCORS: true, logging: false });
    const url = canvas.toDataURL("image/png");
    const fname = `終焉マトリクス_${period()?.label || ""}_${todayStr()}.png`;
    openModal("編成画像", `<img class="shot" src="${url}" alt="編成画像"><div class="kv" style="text-align:center;margin-top:8px;color:var(--muted)">「ダウンロード」か、画像を右クリック（スマホは長押し）で保存できます。</div>`,
      `<span class="sp"></span><a class="btn" href="${url}" download="${esc(fname)}">ダウンロード</a>`);
  } catch (err) { toast("画像の生成に失敗しました: " + (err?.message || err)); }
}

/* --- 編成をテキストでコピー --- */
async function copyTeamsText() {
  const p = period();
  const lines = [`【終焉マトリクス ${p ? p.label + " " + p.ver : ""}】`].concat(teams().map((t, i) =>
    `${teamLabel(t, i)}: ${t.members.map(id => charById(id)?.name || id).join(" / ") || "（空）"}${t.memo ? `　※${t.memo}` : ""}`));
  const text = lines.join("\n");
  try { await navigator.clipboard.writeText(text); toast("編成をコピーしました"); }
  catch (e) { openModal("編成テキスト", `<textarea rows="12" readonly>${esc(text)}</textarea>`, ``); }
}

/* ==== 70-events.js ==== */
/* ---------- イベント ---------- */
/* 配置エリア: クリックで外す／チームを選択／空にする */
$("#teams").addEventListener("click", e => {
  if (e.target.closest("input,select,.grip")) return;
  const teamEl = e.target.closest(".team"); if (!teamEl) return;
  const team = teamById(teamEl.dataset.tid); if (!team) return;
  const i = teams().indexOf(team);
  if (e.target.closest("button[data-act='clear']")) {
    if (!team.members.length) return;
    pushUndo(); team.members = []; commit(); toast(`${teamLabel(team, i)} を空にしました`, undoAction()); return;
  }
  const card = e.target.closest(".card");
  if (card) {
    const k = team.members.indexOf(card.dataset.id);
    if (k >= 0) { pushUndo(); const c = charById(card.dataset.id); team.members.splice(k, 1); state.activeTeam = team.id; commit(); toast(`${c?.name || ""} を外しました`, undoAction()); }
    return;
  }
  state.activeTeam = (state.activeTeam === team.id) ? null : team.id; scheduleRender();
});
/* チーム名・メモは入力欄を離れたときに保存 */
$("#teams").addEventListener("change", e => {
  const team = teamById(e.target.closest(".team")?.dataset.tid); if (!team) return;
  if (e.target.classList.contains("tname")) { team.name = e.target.value.trim(); saveState(); }
  else if (e.target.classList.contains("tmemo")) { team.memo = e.target.value.trim(); saveState(); }
});

/* キャラ一覧: クリックで追加（空きがなければ新しいチームを作る） */
$("#roster").addEventListener("click", e => {
  const card = e.target.closest(".card"); if (!card) return;
  const id = card.dataset.id, c = charById(id); if (!c) return;
  let t = pickTeamFor(id);
  if (!t) {
    // 満員・重複以外の理由（未所持・未実装・出撃上限）は空チームでも通らないので、ここで弾かれる
    const fresh = normTeam({});
    if (!canAdd(fresh, id)) return;
    teams().push(fresh); t = fresh;
  }
  addToTeam(t, id); state.activeTeam = t.id; commit();
  toast(`${teamLabel(t, teams().indexOf(t))} に ${c.name} を追加`);
});

/* カードはキーボードでも操作可能（Enter / Space） */
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("card")) { e.preventDefault(); e.target.click(); }
});

$("#chk-all").addEventListener("change", e => { state.ui.showAll = e.target.checked; saveState(); renderRoster(); });
$("#chk-up").addEventListener("change", e => { state.ui.showUpcoming = e.target.checked; saveState(); renderRoster(); });
$("#btn-addteam").addEventListener("click", () => { const t = normTeam({}); teams().push(t); state.activeTeam = t.id; commit(); });
$("#period-sel").addEventListener("change", e => changePeriod(e.target.value));
$("#banner").addEventListener("click", e => {
  const sw = e.target.closest("[data-switch]");
  if (sw) { changePeriod(sw.dataset.switch); toast(`${period().label} に切り替えました`); return; }
  if (e.target.closest("[data-dismiss]")) { ssSet(SS.banner, periodByDate()?.id || ""); renderBanner(); }
});
$("#btn-reset").addEventListener("click", () => {
  if (!confirm(`${period()?.label || ""} の全チームの編成を消して、チーム数を${INITIAL_TEAMS}に戻しますか？（所持キャラ登録は残ります）`)) return;
  pushUndo(); plan().teams = newTeams(INITIAL_TEAMS); state.activeTeam = null; commit(); toast("リセットしました", undoAction());
});
$("#btn-prev").addEventListener("click", () => {
  const i = PERIODS.findIndex(p => p.id === state.period);
  const prev = i >= 0 ? PERIODS[i + 1] : null;           // PERIODS は新しい順なので次の要素が前期
  const src = prev && state.plans[prev.id];
  if (!prev || !src || !src.teams.some(t => t.members.length)) { toast(prev ? `${prev.label} の編成がありません` : "前の期間がありません"); return; }
  if (teams().some(t => t.members.length) && !confirm(`${period().label} の現在の編成を ${prev.label} の編成で置き換えますか？`)) return;
  pushUndo(); plan().teams = src.teams.map(t => normTeam({ ...t, id: uid() })); state.activeTeam = null; commit();
  const over = CHARACTERS.filter(isOver).length;
  toast(`${prev.label} の編成をコピーしました${over ? `（出撃回数の超過 ${over}人）` : ""}`, undoAction());
});
$("#btn-owned").addEventListener("click", openOwnedModal);
$("#btn-shot").addEventListener("click", saveAsImage);
$("#btn-copy").addEventListener("click", copyTeamsText);

/* 表示テーマ: OS設定 → ライト → ダーク の順に切替 */
$("#btn-theme").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || "";
  const next = cur === "" ? "light" : cur === "light" ? "dark" : "";
  if (next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
  try { if (next) localStorage.setItem(LS.theme, next); else localStorage.removeItem(LS.theme); } catch (e) { /* ignore */ }
  toast(next === "light" ? "ライト表示" : next === "dark" ? "ダーク表示" : "OSの設定に合わせる");
});

/* スマホ幅のタブ */
function setTab(tab) {
  $("#wrap").dataset.tab = tab;
  $$("#tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  ssSet(SS.tab, tab);
}
$("#tabbar").addEventListener("click", e => { const b = e.target.closest("button[data-tab]"); if (b) setTab(b.dataset.tab); });

/* 敵情報パネルの折りたたみ（中間幅では常に閉じた状態で始まり、開くとドロワー表示） */
const midMQ = window.matchMedia("(min-width:641px) and (max-width:1100px)");
function setEnemyClosed(closed, persist = true) {
  $("#wrap").classList.toggle("enemy-closed", closed);
  if (persist && !midMQ.matches) lsSet(LS.enemyClosed, closed);
}
function applyEnemyPref() { setEnemyClosed(midMQ.matches ? true : lsGet(LS.enemyClosed) === true, false); }
$("#btn-enemy-close").addEventListener("click", () => setEnemyClosed(true));
$("#btn-enemy-open").addEventListener("click", () => setEnemyClosed(false));
$("#wrap").addEventListener("click", e => { if (e.target === e.currentTarget && midMQ.matches && !$("#wrap").classList.contains("enemy-closed")) setEnemyClosed(true); });
midMQ.addEventListener("change", applyEnemyPref);

/* ==== 80-boot.js ==== */
/* ---------- 起動 ---------- */
loadState();
$("#chk-all").checked = state.ui.showAll;
$("#chk-up").checked = state.ui.showUpcoming;
const savedTab = ssGet(SS.tab); if (savedTab) setTab(savedTab);
applyEnemyPref();
initContainerSortables();
renderAll();
renderEnemies();
if (!PERIODS.length) toast("期間データがありません（data.json を確認してください）");

})();
