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
