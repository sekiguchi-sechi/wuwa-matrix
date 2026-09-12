/* ---------- モーダル ---------- */
let modalReturnFocus = null;
function openModal(title, body, footer) {
  modalReturnFocus = document.activeElement;
  $("#modal-root").innerHTML = `<div class="modal" id="modal"><div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="mh"><h3>${esc(title)}</h3><span class="sp"></span><button class="ghost" data-close>閉じる</button></div>
    <div class="mb">${body}</div>${footer ? `<div class="mf">${footer}</div>` : ""}</div></div>`;
  const m = $("#modal");
  m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", modalKeys);
  (m.querySelector(".mf .primary") || m.querySelector("[data-close]")).focus();
  return m;
}
function modalKeys(e) {
  if (e.key === "Escape") { closeModal(); return; }
  if (e.key !== "Tab") return;
  // フォーカスをモーダル内に留める
  const f = $$("#modal button:not([hidden]), #modal input, #modal select, #modal textarea, #modal a[href], #modal [tabindex='0']").filter(el => !el.disabled);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
}
function closeModal() {
  $("#modal-root").innerHTML = "";
  document.removeEventListener("keydown", modalKeys);
  if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus();
  modalReturnFocus = null;
}

/* --- 所持キャラ登録 --- */
function openOwnedModal() {
  const draft = new Set(state.owned);
  const grid = rank => CHARACTERS.filter(c => c.rank === rank).map(c => cardHtml(c, { cls: draft.has(c.id) ? "own" : "" })).join("");
  const m = openModal("所持キャラ登録", `
    <div class="kv" style="margin-bottom:8px;color:var(--muted)">タップで所持／未所持を切り替え。<span id="own-n"></span></div>
    <div class="sec">★5</div><div class="ownergrid">${grid(5)}</div>
    <div class="sec">★4</div><div class="ownergrid">${grid(4)}</div>`,
    `<button data-all="1">全て所持</button><button data-all="0">全て解除</button><span class="sp"></span><button class="primary" data-save>保存</button>`);
  const upd = () => { $("#own-n", m).textContent = `所持 ${draft.size} / ${CHARACTERS.length}`; };
  upd();
  m.addEventListener("click", e => {
    const card = e.target.closest(".ownergrid .card");
    if (card) { const id = card.dataset.id; draft.has(id) ? draft.delete(id) : draft.add(id); card.classList.toggle("own", draft.has(id)); upd(); return; }
    const all = e.target.closest("[data-all]");
    if (all) {
      if (all.dataset.all === "1") CHARACTERS.forEach(c => draft.add(c.id)); else draft.clear();
      $$(".ownergrid .card", m).forEach(el => el.classList.toggle("own", draft.has(el.dataset.id))); upd(); return;
    }
    if (e.target.closest("[data-save]")) {
      state.owned = CHARACTERS.filter(c => draft.has(c.id)).map(c => c.id);
      closeModal(); commit(); toast(`所持キャラを保存しました（${state.owned.length}人）`);
    }
  });
}

/* --- 画像で保存（html2canvas は押したときだけ読み込む） --- */
let html2canvasLoading = null;
function loadHtml2canvas() {
  if (window.html2canvas) return Promise.resolve();
  if (!html2canvasLoading) html2canvasLoading = new Promise((ok, ng) => {
    const s = document.createElement("script"); s.src = "vendor/html2canvas.min.js";
    s.onload = ok; s.onerror = () => { html2canvasLoading = null; ng(new Error("html2canvas の読み込みに失敗")); };
    document.head.appendChild(s);
  });
  return html2canvasLoading;
}
async function saveAsImage() {
  const el = $("#teams");
  if (!el.children.length) { toast("チームがありません"); return; }
  if ($("#wrap").dataset.tab !== "teams") setTab("teams");   // 非表示のパネルは描画できない
  toast("画像を生成中…");
  try {
    await loadHtml2canvas();
    const canvas = await html2canvas(el, { backgroundColor: getComputedStyle(document.body).backgroundColor, scale: 2, useCORS: true, logging: false });
    const url = canvas.toDataURL("image/png");
    const fname = `終焉マトリクス_${period()?.label || ""}_${todayStr()}.png`;
    openModal("編成画像", `<img class="shot" src="${url}" alt="編成画像"><div class="kv" style="text-align:center;margin-top:8px;color:var(--muted)">「ダウンロード」か、画像を右クリック（スマホは長押し）で保存できます。</div>`,
      `<span class="sp"></span><a class="btn" href="${url}" download="${esc(fname)}">ダウンロード</a>`);
  } catch (err) { toast("画像の生成に失敗しました: " + (err?.message || err)); }
}

/* --- 編成をテキストでコピー --- */
async function copyTeamsText() {
  const p = period();
  const lines = [`【終焉マトリクス ${p ? p.label + " " + p.ver : ""}】`].concat(teams().map((t, i) =>
    `${teamLabel(t, i)}: ${t.members.map(id => charById(id)?.name || id).join(" / ") || "（空）"}${t.memo ? `　※${t.memo}` : ""}`));
  const text = lines.join("\n");
  try { await navigator.clipboard.writeText(text); toast("編成をコピーしました"); }
  catch (e) { openModal("編成テキスト", `<textarea rows="12" readonly>${esc(text)}</textarea>`, ``); }
}
