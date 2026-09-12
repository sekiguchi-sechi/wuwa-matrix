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
