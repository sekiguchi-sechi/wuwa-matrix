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
