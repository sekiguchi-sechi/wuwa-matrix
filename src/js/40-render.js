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
