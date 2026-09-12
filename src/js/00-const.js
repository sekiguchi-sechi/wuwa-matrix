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
