/* manage.js — デッキ管理 */

let mgCards = [null,null,null,null], pickerSlot = -1, mgSelectedHero = null;
let activeFilters = new Set();

function initManage() {
  mgCards = [null,null,null,null]; mgSelectedHero = null;
  [0,1,2,3].forEach(i => resetSlotEl(i));
  document.getElementById("mg-name").value = "";
  document.getElementById("picker-area").style.display = "none";
  activeFilters = new Set();

  renderHeroPicker("mg-hero-picker", hid => {
    mgSelectedHero = hid;
    document.querySelectorAll("#mg-hero-picker-list .hero-list-item")
      .forEach(el => el.classList.toggle("selected", el.dataset.hid === hid));
    const input = document.getElementById("mg-hero-picker-input");
    input.value = heroName(hid);
    document.getElementById("mg-hero-picker-clear").classList.add("show");
  }, {});

  buildManageFilterBtns();
  renderMgList();
  setupSlotDrops("ms", 4, (i, cid) => {
    if (isDuplicate(mgCards, cid, i)) { alert("同じカードはすでに使用されています"); return; }
    const card = cardInfo(cid); mgCards[i] = card; updateSlotEl(i, card);
  });
}

// --- スロットUI ---
function updateSlotEl(i, card) {
  const el = document.getElementById(`ms${i}`);
  el.className = "slot has";
  el.querySelector(".s-add").style.display = "none";
  el.querySelectorAll(".slot-ct").forEach(e => e.remove());
  const wrap = document.createElement("div");
  wrap.className = "slot-ct";
  wrap.innerHTML = renderCardTile(card.id);
  el.appendChild(wrap);
}
function resetSlotEl(i) {
  const el = document.getElementById(`ms${i}`);
  el.className = "slot";
  el.querySelector(".s-add").style.display = "";
  el.querySelectorAll(".slot-ct").forEach(e => e.remove());
}
function clearSlot(e, i) { e.stopPropagation(); mgCards[i] = null; resetSlotEl(i); }

function openPicker(slot) {
  if (mgCards[slot]) { mgCards[slot] = null; resetSlotEl(slot); return; }
  pickerSlot = slot;
  document.getElementById("pick-label").textContent = `スロット${slot+1} のカードを選択`;
  document.getElementById("picker-area").style.display = "block";
  renderPickerGrid();
}

// --- カードピッカー ---
function buildManageFilterBtns() {
  document.getElementById("picker-filters").innerHTML =
    buildFilterHTML(FILTER_DEFS, "toggleFilter", "toggleCollabExpand", "resetFilters");
  const area = document.getElementById("collab-expand-area");
  if (area) area.innerHTML = getCollabNames().map(n =>
    `<button class="filt filt-collab" data-k="collab:${n}" onclick="toggleFilter('collab:${n}')">${n}</button>`
  ).join("");
  updateFilterHint();
}

function toggleFilter(k) {
  activeFilters.has(k) ? activeFilters.delete(k) : activeFilters.add(k);
  document.querySelectorAll("#picker-filters .filt, #collab-expand-area .filt")
    .forEach(b => b.classList.toggle("on", activeFilters.has(b.dataset.k)));
  updateFilterHint();
  renderPickerGrid();
}
function resetFilters() {
  activeFilters.clear();
  document.querySelectorAll("#picker-filters .filt, #collab-expand-area .filt")
    .forEach(b => b.classList.remove("on"));
  updateFilterHint();
  renderPickerGrid();
}
function toggleCollabExpand() {
  const area = document.getElementById("collab-expand-area");
  const btn  = document.querySelector(".filt-collab-toggle");
  if (!area) return;
  const open = area.style.display === "flex";
  area.style.display = open ? "none" : "flex";
  btn.textContent = open ? "コラボ ▽" : "コラボ △";
}
function updateFilterHint() {
  const h = document.getElementById("filter-hint");
  if (activeFilters.size === 0) { h.textContent = ""; return; }
  const labels = [...activeFilters].map(k => {
    if (k === "collab") return "コラボ全て";
    if (k.startsWith("collab:")) return k.slice(7);
    return FILTER_DEFS.find(f => f.k === k)?.l || k;
  });
  h.textContent = `フィルター: ${labels.join(" AND ")}`;
}

function renderPickerGrid() {
  const filtered = applyFilters(CARDS, activeFilters).slice(0, 200);
  document.getElementById("picker-count").textContent =
    `${filtered.length}件${filtered.length >= 200 ? " (200件まで表示)" : ""}`;
  document.getElementById("picker-grid").innerHTML = buildPickerHTML(filtered, "selectCard");
}

function selectCard(cardId) {
  if (isDuplicate(mgCards, cardId, pickerSlot)) { alert("同じカードはすでに使用されています"); return; }
  mgCards[pickerSlot] = cardInfo(cardId);
  updateSlotEl(pickerSlot, mgCards[pickerSlot]);
  const next = [0,1,2,3].find(i => i > pickerSlot && !mgCards[i]);
  if (next !== undefined) {
    pickerSlot = next;
    document.getElementById("pick-label").textContent = `スロット${next+1} のカードを選択`;
  } else {
    document.getElementById("picker-area").style.display = "none";
  }
}

// --- デッキ保存・一覧 ---
function mgSave() {
  if (!mgSelectedHero)              { alert("キャラを選択してください"); return; }
  if (mgCards.filter(Boolean).length < 4) { alert("4枚すべてのカードを選択してください"); return; }
  const name = document.getElementById("mg-name").value.trim();
  if (!name) { alert("デッキ名を入力してください"); return; }
  decks.push({ id:Date.now(), heroId:mgSelectedHero, cards:mgCards.map(c => c.id), name });
  saveDecks();
  initManage();
}

function renderMgList() {
  const el = document.getElementById("mg-list");
  if (decks.length === 0) {
    el.innerHTML = '<p style="font-size:13px;color:var(--text3);padding:10px 0">まだデッキがありません</p>';
    return;
  }
  el.innerHTML = decks.map(d => {
    const tiles = (d.cards || []).map(cid =>
      `<div style="width:calc(25% - 4px);flex-shrink:0;aspect-ratio:0.72;border-radius:6px;overflow:hidden;border:1px solid var(--border);position:relative;background:var(--bg3)">
        ${renderCardTile(cid)}
      </div>`
    ).join("");
    return `<div class="deck-item" style="flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
        <div>
          <div style="font-size:13px;font-weight:600">${heroName(d.heroId)}</div>
          <div style="font-size:11px;color:var(--text2)">${d.name}</div>
        </div>
        <button class="btn-sm btn-danger" onclick="deleteDeck(${d.id})" style="flex-shrink:0">削除</button>
      </div>
      <div style="display:flex;gap:5px;width:100%">${tiles}</div>
    </div>`;
  }).join("");
}

function deleteDeck(id) {
  decks = decks.filter(d => d.id !== id);
  saveDecks(); renderMgList(); refreshTop();
}
