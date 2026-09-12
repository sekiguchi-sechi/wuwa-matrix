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
