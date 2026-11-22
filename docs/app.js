/* 生成物: src/js/*.js を build.py が連結したもの。編集は src/ 側で行う */
(function () {
"use strict";
/* ==== 00-const.js ==== */
/* ---------- 定数 ---------- */
const TEAM_SIZE = 3;          // 1チームの人数
const INITIAL_TEAMS = 6;      // 初期・リセット後のチーム数（上限なし）
const ATTRS = ["回折", "気動", "凝縮", "消滅", "焦熱", "電導", "物理"];
const NAME_MAX = 20;
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
  rotations: [],         // 登録したローテ（期間をまたいで共通。65-rotations.js）
  activeTeam: null,      // クリック追加の対象チームID（非永続）
  ui: { showAll: false, showUpcoming: false },
};

function normTeam(t) {
  return { id: t.id || uid(), name: t.name || "", memo: t.memo || "", rot: t.rot || "", members: Array.isArray(t.members) ? t.members.slice() : [] };
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
function stateDoc() { return { v: 4, period: state.period, owned: state.owned, plans: state.plans, rotations: state.rotations, ui: state.ui }; }
function hydrate(d) {
  if (!d || typeof d !== "object") return;
  if (d.period) state.period = d.period;
  if (Array.isArray(d.owned)) state.owned = d.owned.filter(id => CHAR_BY_ID.has(id));
  if (d.plans && typeof d.plans === "object") {
    state.plans = {};
    for (const k in d.plans) state.plans[k] = { teams: (d.plans[k].teams || []).map(normTeam) };
  }
  if (Array.isArray(d.rotations)) state.rotations = d.rotations.map(normRot);
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
          <button class="small danger" data-act="del" title="このチームを削除する">削除</button>
        </div>
        <div class="slots" data-tid="${esc(t.id)}">
          ${t.members.map(id => { const c = charById(id); return c ? cardHtml(c, { over: true }) : `<div class="card" data-id="${esc(id)}"><span class="nm">不明: ${esc(id)}</span></div>`; }).join("")}
          <div class="slotbg" aria-hidden="true">${Array.from({ length: TEAM_SIZE }, () => `<i>空き</i>`).join("")}</div>
        </div>
        ${rotRowHtml(t)}
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
   各チームの .slots は描画のたびに作り直されるので renderTeams から再生成する。
   空き枠(.slotbg)は絶対配置の背景なので、ドラッグ中の並び替えに巻き込まれない。 */
let slotSortables = [];

/** 全チーム共通のドラッグ設定。forceFallback でPC/スマホとも同じ見た目・挙動にする */
const CARD_DRAG = {
  animation: DRAG_ANIM, ghostClass: "sortable-ghost", chosenClass: "sortable-chosen",
  forceFallback: true, fallbackOnBody: true, fallbackTolerance: 4, fallbackClass: "drag-fb",
  delay: DRAG_DELAY, delayOnTouchOnly: true, emptyInsertThreshold: 30,
  onMove: ev => highlightTarget(ev.to),
  onEnd: () => highlightTarget(null),
};
function highlightTarget(container) {
  const team = container && container.closest ? container.closest(".team") : null;
  $$(".team.drop-target").forEach(el => { if (el !== team) el.classList.remove("drop-target"); });
  if (team) team.classList.add("drop-target");
  $("#roster-panel").classList.toggle("drop-target", !!container && container.id === "roster");
}

function initContainerSortables() {
  // チームの並べ替え（左端の ⋮⋮ をつかむ）
  new Sortable($("#teams"), {
    handle: ".grip", draggable: ".team", animation: DRAG_ANIM, ghostClass: "sortable-ghost",
    forceFallback: true, fallbackOnBody: true, fallbackTolerance: 4, fallbackClass: "drag-fb",
    onEnd: ev => {
      if (ev.oldIndex === ev.newIndex) return;
      const ts = teams(); const [t] = ts.splice(ev.oldIndex, 1); ts.splice(ev.newIndex, 0, t); commit();
    },
  });
  // キャラ一覧: 複製してチームへ。チームからここへ落とすと外す
  new Sortable($("#roster"), {
    ...CARD_DRAG,
    group: { name: "cards", pull: "clone", put: true }, sort: false, draggable: ".card",
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
    ...CARD_DRAG,
    group: {
      name: "cards", pull: true,
      // ドラッグ中に受け入れ可否を判定（満員・重複・出撃上限なら落とせない）
      put: (to, from, dragEl) => canAdd(teamById(to.el.dataset.tid), dragEl.dataset.id, { quiet: true, from: teamById(from.el.dataset.tid) }),
    },
    draggable: ".card",
    onAdd: ev => {
      const to = teamById(ev.to.dataset.tid), from = teamById(ev.from.dataset.tid), id = ev.item.dataset.id;
      if (from) { const i = from.members.indexOf(id); if (i >= 0) from.members.splice(i, 1); }
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
/** opts.beforeClose: 閉じる前に呼ばれ、false を返すと閉じない（編集中の破棄確認用） */
let modalGuard = null;
function openModal(title, body, footer, opts = {}) {
  if (!$("#modal-root").innerHTML) modalReturnFocus = document.activeElement;   // モーダル間の遷移では最初の戻り先を保つ
  modalGuard = opts.beforeClose || null;
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
function closeModal(force) {
  if (!force && modalGuard && !modalGuard()) return;
  modalGuard = null;
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
    `${teamLabel(t, i)}: ${t.members.map(id => charById(id)?.name || id).join(" / ") || "（空）"}${rotById(t.rot) ? `　［ローテ: ${rotLabel(rotById(t.rot))}］` : ""}${t.memo ? `　※${t.memo}` : ""}`));
  const text = lines.join("\n");
  try { await navigator.clipboard.writeText(text); toast("テキストをコピーしました"); }
  catch (e) { openModal("編成テキスト", `<textarea rows="12" readonly>${esc(text)}</textarea>`, ``); }
}

/* ==== 65-rotations.js ==== */
/* ---------- ローテーション（編成ごとの立ち回り手順） ----------
   state.rotations: [{ id, name, members:[charId×最大3], sections:[{ title, steps:[{ cid, acts }] }], note }]
   期間をまたいで共通。チームは team.rot にローテIDを持つ。
   acts は「重撃 通常4 Q音骸」のようにスペースか → で区切った行動列（表示時にチップ化） */
const ROT_NAME_MAX = 30, ROT_TITLE_MAX = 20, ROT_ACTS_MAX = 200, ROT_NOTE_MAX = 500;
const ROT_DEFAULT_SECTIONS = ["開幕ローテ", "ループローテ"];

function normRot(r) {
  r = r && typeof r === "object" ? r : {};
  const str = (v, n) => String(v ?? "").slice(0, n);
  return {
    id: r.id || "r" + uid().slice(1),
    name: str(r.name, ROT_NAME_MAX),
    members: (Array.isArray(r.members) ? r.members : []).filter(id => CHAR_BY_ID.has(id)).slice(0, TEAM_SIZE),
    sections: (Array.isArray(r.sections) ? r.sections : []).map(s => ({
      title: str(s?.title, ROT_TITLE_MAX),
      steps: (Array.isArray(s?.steps) ? s.steps : []).map(st => ({ cid: String(st?.cid || ""), acts: str(st?.acts, ROT_ACTS_MAX) })),
    })),
    note: str(r.note, ROT_NOTE_MAX),
  };
}
const rotById = id => id ? state.rotations.find(r => r.id === id) : undefined;
const charName = id => charById(id)?.name || "?";
const rotLabel = r => r.name || r.members.map(charName).join("・") || "無題のローテ";
/** チームの3人とローテの3人が同じ顔ぶれか（並び順は問わない） */
const sameMembers = (r, t) => t.members.length > 0 && r.members.length === t.members.length && t.members.every(id => r.members.includes(id));
const splitActs = s => String(s || "").split(/\s*(?:→|->|⇒|»|>|、|,|，)\s*|\s+/).filter(Boolean);

function miniIcon(id, cls = "") {
  const c = charById(id);
  if (!c) return `<span class="mi ${cls}" style="--ecol:var(--e-物理)">?</span>`;
  const attr = ATTRS.includes(c.attr) ? c.attr : "物理";
  return c.icon
    ? `<img class="mi ${cls}" src="${esc(c.icon)}" alt="" style="--ecol:var(--e-${attr})" loading="lazy">`
    : `<span class="mi ${cls}" style="--ecol:var(--e-${attr})">${esc(c.name.slice(0, 1))}</span>`;
}
/** 行動チップ。先頭が Q/E/R/F + 日本語ならキー表示にする（例: Q音骸 → [Q]音骸） */
function actChip(tok) {
  const m = tok.match(/^([QERFqerf])(?=[^\x00-\x7F])(.+)$/);
  return m ? `<span class="act"><kbd>${esc(m[1].toUpperCase())}</kbd>${esc(m[2])}</span>` : `<span class="act">${esc(tok)}</span>`;
}

/* --- 配置エリアのローテ欄 --- */
function rotRowHtml(t) {
  const legacy = t.memo ? `<div class="tmemo-old" title="メモ欄は廃止しました。ローテに書き写したら × で消せます"><span>旧メモ: ${esc(t.memo)}</span><button class="small ghost" data-act="memo-del" aria-label="旧メモを削除">×</button></div>` : "";
  const r = rotById(t.rot);
  if (r) return `<div class="trot"><button class="rotbtn" data-act="rot-view" title="ローテを表示">${r.members.map(id => miniIcon(id)).join("")}<span>${esc(rotLabel(r))}</span><b aria-hidden="true">▶</b></button><button class="small ghost" data-act="rot-unlink" title="ローテの紐づけを外す" aria-label="ローテの紐づけを外す">×</button></div>${legacy}`;
  const opt = x => `<option value="${esc(x.id)}">${esc(rotLabel(x))}${x.name ? `（${esc(x.members.map(charName).join("・"))}）` : ""}</option>`;
  const match = state.rotations.filter(x => sameMembers(x, t)), rest = state.rotations.filter(x => !sameMembers(x, t));
  return `<div class="trot"><select class="trotsel" aria-label="ローテを紐づけ">
      <option value="">ローテを選択…</option>
      ${match.length ? `<optgroup label="このチームと同じ3人">${match.map(opt).join("")}</optgroup>` : ""}
      ${rest.length ? `<optgroup label="${match.length ? "その他のローテ" : "登録済みのローテ"}">${rest.map(opt).join("")}</optgroup>` : ""}
      <option value="__new">＋ 新しくローテを登録…</option>
    </select></div>${legacy}`;
}

/* --- 閲覧 --- */
function rotViewHtml(r) {
  const secs = r.sections.filter(s => s.steps.length).map(s => `
    <div class="rsec"><div class="rsec-h">${esc(s.title || "ローテ")}</div>
      <div class="rsteps">${s.steps.map(st => `<div class="rstep">
        <span class="rch">${miniIcon(st.cid, "lg")}<small>${esc(charName(st.cid))}</small></span>
        <span class="acts">${splitActs(st.acts).map(actChip).join("") || `<span class="act empty">—</span>`}</span>
      </div>`).join(`<span class="rarr" aria-hidden="true">»</span>`)}</div></div>`).join("");
  return `<div class="rmembers">${r.members.map(id => `<span>${miniIcon(id)}${esc(charName(id))}</span>`).join("")}</div>
    ${secs || `<div class="empty">手順が未登録です。「編集」から追加できます。</div>`}
    ${r.note ? `<div class="note">${esc(r.note)}</div>` : ""}`;
}
function rotText(r) {
  const lines = [`■${rotLabel(r)}（${r.members.map(charName).join(" / ")}）`];
  r.sections.filter(s => s.steps.length).forEach(s => {
    lines.push(`【${s.title || "ローテ"}】`);
    s.steps.forEach(st => lines.push(`${charName(st.cid)}: ${splitActs(st.acts).join(" → ")}`));
  });
  if (r.note) lines.push(r.note);
  return lines.join("\n");
}
function openRotView(id, teamId) {
  const r = rotById(id); if (!r) { toast("ローテが見つかりません"); return; }
  const m = openModal(rotLabel(r), rotViewHtml(r),
    `<button data-copy>テキストでコピー</button>${teamId ? `<button class="ghost" data-unlink>このチームから外す</button>` : ""}<span class="sp"></span><button class="primary" data-edit>編集</button>`);
  m.querySelector(".box").classList.add("wide");
  m.addEventListener("click", async e => {
    if (e.target.closest("[data-edit]")) { openRotEditor(r.id, { onDone: () => openRotView(r.id, teamId) }); return; }
    if (e.target.closest("[data-unlink]")) { const t = teamById(teamId); if (t) { pushUndo(); t.rot = ""; commit(); } closeModal(true); toast("ローテの紐づけを外しました", undoAction()); return; }
    if (e.target.closest("[data-copy]")) {
      const text = rotText(r);
      try { await navigator.clipboard.writeText(text); toast("ローテをコピーしました"); }
      catch (err) { openModal("ローテのテキスト", `<textarea rows="14" readonly>${esc(text)}</textarea>`, ``); }
    }
  });
}

/* --- 一覧（ヘッダーの「ローテ登録」） --- */
function openRotList() {
  const items = state.rotations.map(r => `<div class="rotitem" data-rid="${esc(r.id)}">
      <span class="ics">${r.members.map(id => miniIcon(id)).join("")}</span>
      <span class="rn"><b>${esc(rotLabel(r))}</b><small>${esc(r.members.map(charName).join("・"))}　${r.sections.reduce((n, s) => n + s.steps.length, 0)}手順</small></span>
      <button class="small" data-view>表示</button><button class="small" data-edit>編集</button><button class="small" data-dup>複製</button><button class="small danger" data-del>削除</button>
    </div>`).join("");
  const m = openModal("ローテ登録", `
    <div class="kv" style="margin-bottom:8px;color:var(--muted)">キャラ3人とローテ手順を登録しておくと、配置エリアの各チームに紐づけて表示できます。</div>
    ${items || `<div class="empty">まだローテがありません。「＋ 新しいローテ」から登録してください。</div>`}`,
    `<span class="sp"></span><button class="primary" data-new>＋ 新しいローテ</button>`);
  m.addEventListener("click", e => {
    if (e.target.closest("[data-new]")) { openRotEditor(null, { onDone: openRotList }); return; }
    const it = e.target.closest(".rotitem"); if (!it) return;
    const r = rotById(it.dataset.rid); if (!r) return;
    if (e.target.closest("[data-view]")) openRotView(r.id);
    else if (e.target.closest("[data-edit]")) openRotEditor(r.id, { onDone: openRotList });
    else if (e.target.closest("[data-dup]")) {
      const c = normRot({ ...clone(r), id: "", name: (r.name || rotLabel(r)).slice(0, ROT_NAME_MAX - 4) + "（複製）" });
      state.rotations.splice(state.rotations.indexOf(r) + 1, 0, c); commit(); openRotList(); toast("複製しました");
    } else if (e.target.closest("[data-del]")) {
      if (!confirm(`ローテ「${rotLabel(r)}」を削除しますか？（紐づけているチームからも外れます）`)) return;
      deleteRot(r.id); openRotList(); toast("削除しました");
    }
  });
}
function deleteRot(id) {
  state.rotations = state.rotations.filter(r => r.id !== id);
  for (const k in state.plans) (state.plans[k].teams || []).forEach(t => { if (t.rot === id) t.rot = ""; });
  commit();
}

/* --- 登録・編集 ---
   opts.members: 初期メンバー（チームから新規作成するとき）
   opts.linkTeam: 保存後に紐づけるチームID
   opts.onDone: 保存・削除後に開き直す画面 */
function openRotEditor(id, opts = {}) {
  const orig = rotById(id);
  const d = orig ? clone(orig) : normRot({ members: (opts.members || []).slice(0, TEAM_SIZE), sections: ROT_DEFAULT_SECTIONS.map(title => ({ title, steps: [] })) });
  let dirty = false, q = "", pickerOpen = d.members.length < TEAM_SIZE;
  const m = openModal(orig ? "ローテを編集" : "ローテを登録", `<div class="roted" id="rot-ed"></div>`,
    `${orig ? `<button class="danger" data-delrot>削除</button>` : ""}<span class="sp"></span><button class="ghost" data-close>キャンセル</button><button class="primary" data-save>保存</button>`,
    { beforeClose: () => !dirty || confirm("編集内容を破棄して閉じますか？") });
  m.querySelector(".box").classList.add("wide");
  const box = $("#rot-ed", m);
  const touch = () => { dirty = true; };

  function pickerHtml() {
    const showAll = state.ui.showAll || !state.owned.length;
    const list = CHARACTERS.filter(c => (showAll || state.owned.includes(c.id) || d.members.includes(c.id)) && (state.ui.showUpcoming || !c.upcoming))
      .filter(c => !q || nameMatch(c, q) || c.name.includes(q) || (c.aliases || []).some(a => a.includes(q)));
    return list.map(c => cardHtml(c, { cls: d.members.includes(c.id) ? "own" : "" })).join("") || `<div class="empty" style="grid-column:1/-1">該当するキャラがいません</div>`;
  }
  function stepRow(st, s, i) {
    const opts = d.members.map(cid => `<option value="${esc(cid)}"${cid === st.cid ? " selected" : ""}>${esc(charName(cid))}</option>`).join("")
      + (st.cid && !d.members.includes(st.cid) ? `<option value="${esc(st.cid)}" selected>${esc(charName(st.cid))}（メンバー外）</option>` : "");
    return `<div class="rerow" data-s="${s}" data-i="${i}">
      ${miniIcon(st.cid)}
      <select data-cid aria-label="キャラ">${opts}</select>
      <input type="text" data-acts value="${esc(st.acts)}" maxlength="${ROT_ACTS_MAX}" placeholder="例: 重撃 通常4 Q音骸 R解放" aria-label="行動">
      <span class="rebtns"><button class="small ghost" data-mv="-1" title="上へ" aria-label="上へ" ${i ? "" : "disabled"}>↑</button><button class="small ghost" data-mv="1" title="下へ" aria-label="下へ" ${i < d.sections[s].steps.length - 1 ? "" : "disabled"}>↓</button><button class="small ghost danger" data-rm title="この手順を削除" aria-label="この手順を削除">×</button></span>
    </div>`;
  }
  function draw() {
    box.innerHTML = `
      <label class="relabel">ローテ名<input type="text" class="re-name" value="${esc(d.name)}" maxlength="${ROT_NAME_MAX}" placeholder="例: シグ仇リリー簡易SA（空欄ならキャラ名）"></label>
      <div class="sec">キャラ（${TEAM_SIZE}人まで）</div>
      <div class="remembers">
        ${Array.from({ length: TEAM_SIZE }, (_, k) => d.members[k]
          ? `<button class="remem" data-unpick="${esc(d.members[k])}" title="外す">${miniIcon(d.members[k], "lg")}<span>${esc(charName(d.members[k]))}</span><i aria-hidden="true">×</i></button>`
          : `<span class="remem empty">空き</span>`).join("")}
        <button class="small" data-picker>${pickerOpen ? "キャラ一覧を閉じる" : "キャラを選び直す"}</button>
      </div>
      ${pickerOpen ? `<div class="repicker"><input type="text" class="re-q" value="${esc(q)}" placeholder="名前で絞り込み" aria-label="キャラを名前で絞り込み"><div class="ownergrid" id="re-grid">${pickerHtml()}</div></div>` : ""}
      <div class="sec">手順</div>
      <div class="kv hint">行動はスペースか → で区切ると1つずつのチップで表示されます。先頭が Q・E・R・F ならキー表示（例: <span class="act"><kbd>Q</kbd>音骸</span> <span class="act"><kbd>R</kbd>解放</span> <span class="act">通常4</span>）。</div>
      ${d.sections.map((sec, s) => `<div class="resec" data-s="${s}">
        <div class="resec-h"><input type="text" data-stitle value="${esc(sec.title)}" maxlength="${ROT_TITLE_MAX}" placeholder="区分名（例: 開幕ローテ）" aria-label="区分名"><span class="sp"></span><button class="small ghost danger" data-rmsec>区分を削除</button></div>
        ${sec.steps.map((st, i) => stepRow(st, s, i)).join("")}
        <div class="readd">${d.members.length ? d.members.map(cid => `<button class="small" data-addstep="${esc(cid)}">＋ ${esc(charName(cid))}</button>`).join("") : `<span class="hint">先にキャラを選ぶと手順を追加できます</span>`}</div>
      </div>`).join("")}
      <button class="small" data-addsec>＋ 区分を追加</button>
      <label class="relabel" style="margin-top:12px">補足メモ<textarea class="re-note" rows="3" maxlength="${ROT_NOTE_MAX}" placeholder="狙い・注意点など（任意）">${esc(d.note)}</textarea></label>`;
  }
  draw();

  box.addEventListener("input", e => {
    const el = e.target, row = el.closest(".rerow"), sec = el.closest(".resec");
    if (el.classList.contains("re-name")) d.name = el.value;
    else if (el.classList.contains("re-note")) d.note = el.value;
    else if (el.classList.contains("re-q")) { q = el.value.trim(); $("#re-grid", box).innerHTML = pickerHtml(); return; }
    else if (el.hasAttribute("data-acts") && row) d.sections[+row.dataset.s].steps[+row.dataset.i].acts = el.value;
    else if (el.hasAttribute("data-stitle") && sec) d.sections[+sec.dataset.s].title = el.value;
    else return;
    touch();
  });
  box.addEventListener("change", e => {
    const row = e.target.closest(".rerow");
    if (e.target.hasAttribute("data-cid") && row) { d.sections[+row.dataset.s].steps[+row.dataset.i].cid = e.target.value; touch(); draw(); }
  });
  box.addEventListener("click", e => {
    const t = e.target;
    const card = t.closest("#re-grid .card");
    if (card) {
      const cid = card.dataset.id, k = d.members.indexOf(cid);
      if (k >= 0) d.members.splice(k, 1);
      else if (d.members.length >= TEAM_SIZE) { toast(`キャラは${TEAM_SIZE}人までです（選択中のキャラをタップで外せます）`); return; }
      else d.members.push(cid);
      if (d.members.length >= TEAM_SIZE && k < 0) pickerOpen = false;
      touch(); draw(); return;
    }
    const un = t.closest("[data-unpick]");
    if (un) { d.members = d.members.filter(x => x !== un.dataset.unpick); pickerOpen = true; touch(); draw(); return; }
    if (t.closest("[data-picker]")) { pickerOpen = !pickerOpen; draw(); if (pickerOpen) $(".re-q", box)?.focus(); return; }
    if (t.closest("[data-addsec]")) { d.sections.push({ title: "", steps: [] }); touch(); draw(); $$(".resec [data-stitle]", box).pop()?.focus(); return; }
    const sec = t.closest(".resec"); if (!sec) return;
    const s = +sec.dataset.s, steps = d.sections[s].steps;
    const add = t.closest("[data-addstep]");
    if (add) { steps.push({ cid: add.dataset.addstep, acts: "" }); touch(); draw(); $(`.rerow[data-s="${s}"][data-i="${steps.length - 1}"] [data-acts]`, box)?.focus(); return; }
    if (t.closest("[data-rmsec]")) {
      if (steps.length && !confirm(`区分「${d.sections[s].title || "（無題）"}」と手順${steps.length}件を削除しますか？`)) return;
      d.sections.splice(s, 1); touch(); draw(); return;
    }
    const row = t.closest(".rerow"); if (!row) return;
    const i = +row.dataset.i;
    if (t.closest("[data-rm]")) { steps.splice(i, 1); touch(); draw(); return; }
    const mv = t.closest("[data-mv]");
    if (mv) { const j = i + +mv.dataset.mv; if (j < 0 || j >= steps.length) return; [steps[i], steps[j]] = [steps[j], steps[i]]; touch(); draw(); $(`.rerow[data-s="${s}"][data-i="${j}"] [data-mv="${mv.dataset.mv}"]`, box)?.focus(); }
  });

  m.addEventListener("click", e => {
    if (e.target.closest("[data-save]")) {
      if (!d.members.length) { toast("キャラを1人以上選んでください"); return; }
      const r = normRot({ ...d, name: d.name.trim(), note: d.note.trim(),
        sections: d.sections.map(s => ({ title: s.title.trim(), steps: s.steps.filter(st => st.acts.trim() || st.cid).map(st => ({ cid: st.cid, acts: st.acts.trim() })) })) });
      const k = state.rotations.findIndex(x => x.id === r.id);
      if (k >= 0) state.rotations[k] = r; else state.rotations.push(r);
      const team = opts.linkTeam && teamById(opts.linkTeam);
      if (team) team.rot = r.id;
      dirty = false; commit(); closeModal(true);
      toast(`ローテ「${rotLabel(r)}」を保存しました${team ? "（チームに紐づけ）" : ""}`);
      if (opts.onDone) opts.onDone();
      return;
    }
    if (e.target.closest("[data-delrot]")) {
      if (!confirm(`ローテ「${rotLabel(orig)}」を削除しますか？（紐づけているチームからも外れます）`)) return;
      deleteRot(orig.id); dirty = false; closeModal(true); toast("削除しました");
      if (opts.onDone === openRotList) openRotList();
    }
  });
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
  if (e.target.closest("button[data-act='del']")) {
    if (team.members.length && !confirm(`${teamLabel(team, i)}（${team.members.length}人）を削除しますか？`)) return;
    pushUndo(); teams().splice(i, 1); if (state.activeTeam === team.id) state.activeTeam = null;
    commit(); toast(`${teamLabel(team, i)} を削除しました`, undoAction()); return;
  }
  const act = e.target.closest("button[data-act]")?.dataset.act;
  if (act === "rot-view") { openRotView(team.rot, team.id); return; }
  if (act === "rot-unlink") { pushUndo(); team.rot = ""; commit(); toast("ローテの紐づけを外しました", undoAction()); return; }
  if (act === "memo-del") { pushUndo(); team.memo = ""; commit(); toast("旧メモを削除しました", undoAction()); return; }
  const card = e.target.closest(".card");
  if (card) {
    const k = team.members.indexOf(card.dataset.id);
    if (k >= 0) { pushUndo(); const c = charById(card.dataset.id); team.members.splice(k, 1); state.activeTeam = team.id; commit(); toast(`${c?.name || ""} を外しました`, undoAction()); }
    return;
  }
  state.activeTeam = (state.activeTeam === team.id) ? null : team.id; scheduleRender();
});
/* チーム名は入力欄を離れたときに保存。ローテはプルダウンで紐づけ */
$("#teams").addEventListener("change", e => {
  const team = teamById(e.target.closest(".team")?.dataset.tid); if (!team) return;
  if (e.target.classList.contains("tname")) { team.name = e.target.value.trim(); saveState(); }
  else if (e.target.classList.contains("trotsel")) {
    const v = e.target.value;
    if (v === "__new") { e.target.value = ""; openRotEditor(null, { members: team.members, linkTeam: team.id }); return; }
    if (v && rotById(v)) { team.rot = v; commit(); toast(`ローテ「${rotLabel(rotById(v))}」を紐づけました`); }
  }
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
$("#btn-rots").addEventListener("click", () => openRotList());
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
