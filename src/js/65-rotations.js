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
