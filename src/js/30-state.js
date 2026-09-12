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
