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
