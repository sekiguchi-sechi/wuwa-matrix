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
