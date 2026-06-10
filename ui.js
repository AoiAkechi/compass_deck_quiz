/* ui.js — 画面遷移・共通UI */

// --- 画面遷移 ---
function go(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (id === "s-top")    refreshTop();
  if (id === "s-solo")   refreshSolo();
  if (id === "s-manage") initManage();
  if (id === "s-room") {
    const el = document.getElementById("room-username-display");
    if (el) el.textContent = userName;
  }
}

function refreshTop() {
  document.getElementById("top-count").textContent = `${decks.length}件のデッキが登録されています`;
}
function refreshSolo() {
  const e = document.getElementById("solo-status");
  const b = document.getElementById("solo-go");
  if (decks.length === 0) {
    e.textContent = "デッキが0件です。先に「デッキを管理」から登録してください。";
    b.disabled = true;
  } else {
    e.textContent = `${decks.length}件のデッキが登録されています`;
    b.disabled = false;
  }
}

// --- ユーザー名 ---
let userName = "";

function loadUserName() {
  try { userName = localStorage.getItem("cq_username") || ""; } catch(e) {}
  if (!userName) openNameModal();
  else applyUserName();
}
function applyUserName() {
  const el  = document.getElementById("top-username");
  const rud = document.getElementById("room-username-display");
  if (el)  el.textContent  = userName;
  if (rud) rud.textContent = userName;
}
function openNameModal() {
  const inp = document.getElementById("modal-name-input");
  if (inp) inp.value = userName;
  document.getElementById("name-modal").classList.add("open");
  setTimeout(() => inp && inp.focus(), 100);
}
function handleModalClick(e) {
  if (e.target === document.getElementById("name-modal")) closeNameModal();
}
function closeNameModal() {
  if (!userName) return;
  document.getElementById("name-modal").classList.remove("open");
}
function saveUserName() {
  const v = document.getElementById("modal-name-input").value.trim();
  if (!v) { alert("名前を入力してください"); return; }
  userName = v;
  try { localStorage.setItem("cq_username", userName); } catch(e) {}
  document.getElementById("name-modal").classList.remove("open");
  applyUserName();
}
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && document.getElementById("name-modal").classList.contains("open")) saveUserName();
});

// --- カードタイル ---
function renderCardTile(cid) {
  const c  = cardInfo(cid);
  const em = cardElMeta(c);
  const rm = RAR_META[c.rarity] || { label:c.rarity, cls:"r" };
  const name = c.name && c.name !== c.id ? c.name : c.id;
  const collab = c.collab ? ` <span style="font-size:8px;opacity:.75">${c.collab}</span>` : "";
  return `<div class="ct ${em.cls}">
    <img class="ct-img" src="cards/${c.id}.jpg" alt="${name}"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="ct-noimg" style="display:none">
      <div class="ct-id">${name}</div>
      <div class="ct-el">${cardEmoji(c)} ${em.label}${collab}</div>
      <div class="ct-rar ${rm.cls}">${rm.label}</div>
    </div>
    <div class="ct-overlay">
      <div class="ct-id">${name}</div>
      <div class="ct-rar ${rm.cls}">${rm.label} ${em.label}${collab}</div>
    </div>
  </div>`;
}

function renderCards(containerId, ids) {
  const tiles = (ids || []).map(id => id ? renderCardTile(id) : `<div class="ct empty">？</div>`);
  while (tiles.length < 4) tiles.push(`<div class="ct empty">？</div>`);
  document.getElementById(containerId).innerHTML = tiles.join("");
}

// --- ヒーローピッカー ---
function renderHeroPicker(containerId, onSelect, opts = {}) {
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = `
    <div class="hero-search-wrap">
      <input class="hero-search-input" id="${containerId}-input" placeholder="キャラ名を検索..." autocomplete="off">
      <button class="hero-search-clear" id="${containerId}-clear" onclick="clearHeroSearch('${containerId}')">✕</button>
    </div>
    <div class="hero-list" id="${containerId}-list" style="display:none"></div>`;

  const input = document.getElementById(`${containerId}-input`);
  const list  = document.getElementById(`${containerId}-list`);

  input.onfocus = () => { list.style.display = "block"; updateHeroList(containerId, input.value, onSelect, opts); };
  input.oninput = () => {
    document.getElementById(`${containerId}-clear`).classList.toggle("show", input.value.length > 0);
    list.style.display = "block";
    updateHeroList(containerId, input.value, onSelect, opts);
  };
  document.addEventListener("click", e => {
    if (!wrap.contains(e.target)) list.style.display = "none";
  }, { capture: true });
}

function clearHeroSearch(containerId) {
  const input = document.getElementById(`${containerId}-input`);
  const list  = document.getElementById(`${containerId}-list`);
  const savedOnSelect = list._onSelect || null;
  const savedOpts     = list._opts     || {};
  input.value = "";
  document.getElementById(`${containerId}-clear`).classList.remove("show");
  if (containerId === "mg-hero-picker")   mgSelectedHero   = null;
  if (containerId === "host-hero-picker") hostSelectedHero = null;
  updateHeroList(containerId, "", savedOnSelect, savedOpts);
  list.style.display = "block";
  input.focus();
}

function updateHeroList(containerId, query, onSelect, opts = {}) {
  const list = document.getElementById(`${containerId}-list`);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? HEROES.filter(h => h.name.toLowerCase().includes(q) || h.id.toLowerCase().includes(q))
    : HEROES;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="hero-list-empty">「${query}」は見つかりません</div>`;
    return;
  }
  list.innerHTML = filtered.map(h => {
    let cls = "";
    if      (opts.correctId === h.id) cls = "correct";
    else if (opts.wrongId   === h.id) cls = "wrong";
    else if (opts.revealId  === h.id) cls = "reveal";
    const dis = opts.disabled || false;
    return `<div class="hero-list-item ${cls}${dis?" disabled":""}" data-hid="${h.id}"
      onclick="${dis ? "" : `heroListClick('${containerId}','${h.id}')`}">
      ${h.name}
    </div>`;
  }).join("");
  list._onSelect = onSelect;
  list._opts     = opts;
}

function heroListClick(containerId, hid) {
  const list = document.getElementById(`${containerId}-list`);
  if (list._onSelect) list._onSelect(hid);
  list.style.display = "none";
}

// --- カードフィルター（管理・司会者で共用） ---
function buildFilterHTML(filters, toggleFn, collabToggleFn, resetFn) {
  const rar  = filters.filter(f => f.type === "rarity");
  const el   = filters.filter(f => f.type === "element");
  const type = filters.filter(f => f.type === "cardtype");
  const row  = defs => defs.map(f =>
    `<button class="filt" data-k="${f.k}" onclick="${toggleFn}('${f.k}')">${f.l}</button>`
  ).join("");
  return [
    `<div class="filt-row">${row(rar)}</div>`,
    `<div class="filt-row">${row(el)}</div>`,
    `<div class="filt-row">${row(type)}</div>`,
    `<div class="filt-row">`,
    `<button class="filt filt-collab-toggle" onclick="${collabToggleFn}()">コラボ ▽</button>`,
    `<button class="filt-reset" onclick="${resetFn}()">リセット</button>`,
    `</div>`,
  ].join("");
}

function applyFilters(list, activeFilters) {
  if (activeFilters.size === 0) return list;
  const rar    = [...activeFilters].filter(k => ["ur","sr","r"].includes(k));
  const el     = [...activeFilters].filter(k => ["fire","water","wood","none"].includes(k));
  const types  = [...activeFilters].filter(k => k.startsWith("type:")).map(k => k.slice(5));
  const collabAll   = activeFilters.has("collab");
  const collabNames = [...activeFilters].filter(k => k.startsWith("collab:")).map(k => k.slice(7));
  return list.filter(c => {
    if (rar.length    > 0 && !rar.includes(c.rarity))   return false;
    if (el.length     > 0 && !el.includes(c.element))   return false;
    if (types.length  > 0 && !types.includes(c.type))   return false;
    if (collabAll          && !c.collab)                 return false;
    if (collabNames.length > 0 && !collabNames.includes(c.collab)) return false;
    return true;
  });
}

// --- ピッカーグリッド ---
function buildPickerHTML(filtered, onClickFn) {
  let out = "", lastGroup = "";
  for (const card of filtered) {
    const group = card.rank ? `${card.rank}ランク` : (card.collab || "コラボ");
    if (group !== lastGroup) {
      out += `<div class="card-sep"><div class="card-sep-line"></div><div class="card-sep-label">${group}</div><div class="card-sep-line"></div></div>`;
      lastGroup = group;
    }
    const em = cardElMeta(card);
    const rm = RAR_META[card.rarity] || { label:card.rarity, cls:"r" };
    const name = card.name && card.name !== card.id ? card.name : card.id;
    out += `<div class="pick-card" draggable="true" data-cid="${card.id}"
      onclick="${onClickFn}('${card.id}')"
      ondragstart="onPickCardDragStart(event,'${card.id}')">
      <img class="pc-img" src="cards/${card.id}.jpg" alt="${name}"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="pc-noimg" style="display:none;width:100%;aspect-ratio:0.72;align-items:center;justify-content:center;font-size:20px;background:var(--bg3)">${cardEmoji(card)}</div>
      <div class="pc-id">${name}</div>
      <div class="pc-rar ${rm.cls}">${rm.label} ${em.label}</div>
    </div>`;
  }
  return out;
}

// --- スコア表示 ---
function renderScores(containerId, sc) {
  if (!sc) return;
  const sorted = Object.entries(sc).sort((a, b) => b[1] - a[1]);
  const labels = ["1位","2位","3位"];
  document.getElementById(containerId).innerHTML =
    `<div class="lbl" style="margin-top:10px">スコア</div>` +
    sorted.map(([n, p], i) =>
      `<div class="score-row"><span>${labels[i]||`${i+1}位`} ${n}</span><span class="score-pts">${p}pt</span></div>`
    ).join("");
}
