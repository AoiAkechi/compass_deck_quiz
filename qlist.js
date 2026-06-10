/* qlist.js — 問題リスト */

let questionLists = [];

function saveQLists() { try { localStorage.setItem("cq_qlists", JSON.stringify(questionLists)); } catch(e) {} }
function loadQLists() { try { const r = localStorage.getItem("cq_qlists"); if (r) questionLists = JSON.parse(r); } catch(e) {} }

function go_qlist() {
  loadQLists();
  renderQListManage();
  go("s-qlist");
}

function renderQListManage() {
  const deckArea = document.getElementById("ql-deck-select");
  deckArea.innerHTML = decks.length === 0
    ? '<p style="font-size:13px;color:var(--text3)">デッキが登録されていません</p>'
    : decks.map(d => `
      <label class="ql-deck-row">
        <input type="checkbox" class="ql-check" data-id="${d.id}">
        <span class="ql-deck-name">${heroName(d.heroId)} — ${d.name}</span>
      </label>`).join("");
  renderQListSaved();
}

function renderQListSaved() {
  const el = document.getElementById("ql-saved-list");
  if (questionLists.length === 0) {
    el.innerHTML = '<p style="font-size:13px;color:var(--text3)">まだリストがありません</p>';
    return;
  }
  el.innerHTML = questionLists.map(ql => `
    <div class="ql-item">
      <div class="ql-item-info">
        <div class="ql-item-name">${ql.name}</div>
        <div class="ql-item-meta">${ql.deckIds.length}問 · ${ql.author||"自分"}</div>
      </div>
      <div class="ql-item-actions">
        <button class="btn-sm" onclick="startSoloFromList(${ql.localId})">ソロ</button>
        <button class="btn-sm" onclick="useListForHost(${ql.localId})">対戦</button>
        <button class="btn-sm" onclick="publishList(${ql.localId})">公開</button>
        <button class="btn-sm btn-danger" onclick="deleteQList(${ql.localId})">削除</button>
      </div>
    </div>`).join("");
}

function qlSave() {
  const name    = document.getElementById("ql-name").value.trim();
  if (!name) { alert("リスト名を入力してください"); return; }
  const checked = [...document.querySelectorAll(".ql-check:checked")].map(c => parseInt(c.dataset.id));
  if (checked.length === 0) { alert("デッキを1件以上選択してください"); return; }
  questionLists.push({
    localId: Date.now(), name, deckIds: checked,
    author: localStorage.getItem("cq_username") || "名無し",
  });
  saveQLists();
  document.getElementById("ql-name").value = "";
  document.querySelectorAll(".ql-check").forEach(c => c.checked = false);
  renderQListSaved();
  alert(`「${name}」を保存しました`);
}

function deleteQList(localId) {
  questionLists = questionLists.filter(q => q.localId !== localId);
  saveQLists();
  renderQListSaved();
}

function resolveListDecks(localId) {
  const ql = questionLists.find(q => q.localId === localId);
  if (!ql) return [];
  return decks.filter(d => ql.deckIds.includes(d.id));
}

function startSoloFromList(localId) {
  const listDecks = resolveListDecks(localId);
  if (listDecks.length === 0) { alert("リストに有効なデッキがありません"); return; }
  startSolo(listDecks);
}

function useListForHost(localId) {
  if (resolveListDecks(localId).length === 0) { alert("リストに有効なデッキがありません"); return; }
  const ql = questionLists.find(q => q.localId === localId);
  alert(`「${ql.name}」を対戦用リストにセットしました。\n部屋を作成してください。`);
  go("s-room");
}

async function publishList(localId) {
  const ql = questionLists.find(q => q.localId === localId);
  if (!ql) { alert("リストが見つかりません"); return; }
  if (typeof window.fbPublishList !== "function") { alert("Firebase未接続です"); return; }
  const btn = event.target;
  btn.disabled = true; btn.textContent = "公開中…";
  try {
    const listId = await window.fbPublishList(ql.name, ql.deckIds);
    await navigator.clipboard.writeText(listId);
    alert(`公開しました！\nリストID: ${listId}\n（クリップボードにコピーしました）`);
  } catch(e) {
    alert("公開に失敗しました: " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "公開";
  }
}

async function importListById() {
  const listId = document.getElementById("ql-import-id").value.trim();
  if (!listId) { alert("リストIDを入力してください"); return; }
  if (typeof window.fbFetchList !== "function") { alert("Firebase未接続です"); return; }
  const btn = document.getElementById("ql-import-btn");
  btn.disabled = true; btn.textContent = "取得中…";
  try {
    const data = await window.fbFetchList(listId);
    if (!data) { alert("リストが見つかりませんでした"); return; }

    let addedCount = 0;
    const newDeckIds = [];
    for (const fd of data.decks) {
      const exists = decks.find(d => d.heroId === fd.heroId && JSON.stringify(d.cards) === JSON.stringify(fd.cards));
      if (exists) {
        newDeckIds.push(exists.id);
      } else {
        const newId = Date.now() + addedCount;
        decks.push({ id:newId, heroId:fd.heroId, cards:fd.cards, name:fd.name||fd.heroName });
        newDeckIds.push(newId);
        addedCount++;
      }
    }
    if (addedCount > 0) saveDecks();

    questionLists.push({
      localId: Date.now(), name:`${data.listName}（${data.userName}）`,
      deckIds: newDeckIds, author: data.userName,
    });
    saveQLists();
    document.getElementById("ql-import-id").value = "";
    renderQListManage();
    refreshTop();
    alert(`「${data.listName}」をインポートしました（${addedCount}件のデッキを追加）`);
  } catch(e) {
    alert("インポートに失敗しました: " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "インポート";
  }
}
