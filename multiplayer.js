/* multiplayer.js — マルチプレイ */

let peer = null, hostConn = null, playerConns = {};
let scores = {}, hostCurDeck = null;
let gameRules = { time:20, pts:1, first:2, penalty:0, goal:0 };
let gameStarted = false;

const REVEAL_RESET_DELAY = 5000;

// --- 合言葉 → PeerJS ID ---
function ppToId(pp) {
  const normalized = pp.trim().toLowerCase().replace(/\s+/g, "");
  return encodeURIComponent(normalized).replace(/%/g, "-").replace(/[^a-z0-9\-_]/gi, "").replace(/^-+/, "");
}

// --- 部屋作成（司会者） ---
function createRoom() {
  const myName = userName || "司会者";
  const rawPP  = document.getElementById("room-passphrase").value.trim();
  if (!rawPP) { alert("合言葉を入力してください"); return; }
  const peerId = ppToId(rawPP);
  if (!peerId) { alert("使用できない文字が含まれています"); return; }

  scores = {}; gameStarted = false; closePeer();
  peer = new Peer("cq-room-" + peerId, { debug:0 });
  peer.on("open", () => {
    document.getElementById("lobby-passphrase-display").textContent = rawPP;
    document.getElementById("lobby-peer-count").textContent = "0";
    document.getElementById("lobby-peer-list").innerHTML = "";
    go("s-host-lobby");
  });
  peer.on("connection", conn => {
    playerConns[conn.peer] = { conn, name:"" };
    conn.on("open",  () => { conn.send({ type:"welcome", hostName:myName, rules:readRules(), started:gameStarted }); updateLobbyPeers(); });
    conn.on("data",  d  => handleHost(d, conn));
    conn.on("close", () => { delete playerConns[conn.peer]; updateLobbyPeers(); updatePeers(); });
  });
  peer.on("error", e => alert("接続エラー: " + e.message));
}

function readRules() {
  const n = (id, def) => Math.max(0, parseInt(document.getElementById(id)?.value) || def);
  return {
    time:    Math.max(5, n("rule-time",    20)),
    pts:     Math.max(1, n("rule-pts",      1)),
    first:              n("rule-first",     2),
    penalty:            n("rule-penalty",   0),
    goal:               n("rule-goal",      0),
  };
}

function hostStartGame() {
  gameRules   = readRules();
  gameStarted = true;
  const hostParticipates = document.getElementById("rule-host-join")?.checked || false;
  bcast({ type:"game-start", rules:gameRules });

  if (hostParticipates) {
    // ホストもスコアに追加してプレイヤー画面へ
    const myName = userName || "司会者";
    if (!scores[myName]) scores[myName] = 0;
    // ホスト用の擬似hostConnを作成（自分自身にメッセージを送る仕組み）
    _plMyName = myName;
    _hostParticipating = true;
    document.getElementById("pl-sub").textContent    = "司会者の出題を待っています";
    document.getElementById("pl-flash").innerHTML    = "";
    setBadge(document.getElementById("pl-badge"), "待機中", "b-warn");
    document.getElementById("pl-quiz").style.display = "block";
    renderCards("pl-cards", [null, null, null, null]);
    document.getElementById("pl-hero-picker").innerHTML    = "";
    document.getElementById("pl-answer-btn").style.display = "none";
    document.getElementById("p-timer").style.width         = "0%";
    go("s-player");
  } else {
    _hostParticipating = false;
    document.getElementById("peer-count").textContent = Object.values(playerConns).length;
    document.getElementById("peer-list").innerHTML =
      Object.values(playerConns).map(p => `<span class="peer-tag">${p.name||"?"}</span>`).join("");
    document.getElementById("host-log").innerHTML = '<p style="color:var(--text3)">まだ回答がありません</p>';
    initHostDeckBuilder();
    go("s-host");
  }
}

function updateLobbyPeers() {
  const entries = Object.values(playerConns);
  document.getElementById("lobby-peer-count").textContent = entries.length;
  document.getElementById("lobby-peer-list").innerHTML = entries.length === 0
    ? '<span style="font-size:12px;color:var(--text3)">まだ誰もいません</span>'
    : entries.map(p => `<span class="peer-tag">${p.name||"接続中…"}</span>`).join("");
}

function copyLobbyPassphrase() {
  const pp = document.getElementById("lobby-passphrase-display").textContent;
  if (!pp) return;
  navigator.clipboard.writeText(pp).then(() => {
    const btn = event.target, orig = btn.textContent;
    btn.textContent = "コピー済み";
    setTimeout(() => btn.textContent = orig, 2000);
  });
}

// --- 参加（プレイヤー） ---
function joinRoom() {
  const rawPP = document.getElementById("join-id").value.trim();
  if (!rawPP) { alert("合言葉を入力してください"); return; }
  const peerId = ppToId(rawPP);
  if (!peerId) { alert("使用できない文字が含まれています"); return; }
  const myName = userName || "プレイヤー";
  closePeer();
  peer = new Peer(undefined, { debug:0 });
  peer.on("open", () => {
    hostConn = peer.connect("cq-room-" + peerId);
    hostConn.on("open",  () => hostConn.send({ type:"join", name:myName }));
    hostConn.on("data",  d  => handlePlayer(d, myName));
    hostConn.on("close", () => {
      alert("司会者が切断されました。ホームに戻ります。");
      closePeer();
      go("s-top");
    });
    hostConn.on("error", () => alert("接続できませんでした。合言葉を確認してください"));
  });
  peer.on("error", e => alert("接続エラー: " + e.message));
}

// --- 司会者：受信 ---
function handleHost(data, conn) {
  if (data.type === "join") {
    if (playerConns[conn.peer]) playerConns[conn.peer].name = data.name;
    if (!scores[data.name]) scores[data.name] = 0;
    updateLobbyPeers(); updatePeers(); bcastScores();
    if (!gameStarted) {
      const peers = Object.values(playerConns).map(p => p.name);
      bcast({ type:"lobby-update", rules:readRules(), peers });
    }
  }
  if (data.type === "answer") {
    const correct = hostCurDeck && data.heroId === hostCurDeck.heroId;
    const r = gameRules;
    // ホスト参加中の自己回答はスコア計算しない（別途plSubmitAnswerから来る）
    if (data._fromHost) return;
    const pts = correct && data.first ? r.pts + r.first : correct ? r.pts : -r.penalty;
    scores[data.name] = Math.max(0, (scores[data.name] || 0) + pts);
    const ptLabel = correct && data.first ? `早押し+${r.pts+r.first}` : correct ? `+${r.pts}` : r.penalty > 0 ? `-${r.penalty}` : "";
    addLog(`${correct?"○":"×"} ${data.name}：${heroName(data.heroId)}${ptLabel ? " "+ptLabel : ""}`);
    bcastScores();
    conn.send({ type:"answer-result", correct, first:data.first&&correct, scores, pts });
    if (r.goal > 0 && scores[data.name] >= r.goal) {
      const winner = data.name;
      bcast({ type:"game-end", winner, scores });
      setTimeout(() => { alert(`ゲーム終了　優勝：${winner} (${scores[winner]}pt)`); renderScores("host-scores", scores); }, 200);
    }
  }
}

// --- プレイヤー状態 ---
let _plAnswered = false, _plSelectedHid = null, _plCurrentData = null, _plMyName = "";
let _hostParticipating = false;

// --- 参加者：受信 ---
function handlePlayer(data, myName) {
  _plMyName = myName;
  rules = data.rules || {};

  if (data.type === "welcome") {
    document.getElementById("ploby-sub").textContent = `司会者: ${data.hostName}`;
    setBadge(document.getElementById("ploby-badge"), "接続済み", "b-ok");
    renderLobbyRules(rules);
    if (data.started) { gameRules = rules; go("s-player"); }
    else              { go("s-player-lobby"); }
  }

  if (data.type === "lobby-update") {
    renderLobbyRules(rules);
    if (data.peers) {
      document.getElementById("ploby-peer-list").innerHTML =
        data.peers.map(n => `<span class="peer-tag">${n}</span>`).join("");
    }
  }

  if (data.type === "game-start") {
    gameRules = rules;
    document.getElementById("pl-sub").textContent    = "司会者の出題を待っています";
    document.getElementById("pl-flash").innerHTML    = "";
    setBadge(document.getElementById("pl-badge"), "待機中", "b-warn");
    // 出題前から？カード枠を表示しておく
    document.getElementById("pl-quiz").style.display = "block";
    renderCards("pl-cards", [null, null, null, null]);
    document.getElementById("pl-hero-picker").innerHTML = "";
    document.getElementById("pl-answer-btn").style.display = "none";
    document.getElementById("p-timer").style.width = "0%";
    go("s-player");
  }

  if (data.type === "question") {
    _plAnswered = false; _plSelectedHid = null; _plCurrentData = data;
    clearInterval(window._pTI);
    setBadge(document.getElementById("pl-badge"), "出題中", "b-warn");
    document.getElementById("pl-flash").innerHTML    = "";
    document.getElementById("pl-answer-btn").style.display = "none";
    document.getElementById("pl-quiz").style.display = "block";
    renderCards("pl-cards", data.cards);

    renderHeroPicker("pl-hero-picker", hid => {
      if (_plAnswered) return;
      _plSelectedHid = hid;
      document.querySelectorAll("#pl-hero-picker-list .hero-list-item")
        .forEach(el => el.classList.toggle("selected", el.dataset.hid === hid));
      document.getElementById("pl-hero-picker-input").value = heroName(hid);
      document.getElementById("pl-hero-picker-clear").classList.add("show");
      document.getElementById("pl-answer-btn").style.display = "block";
    }, {});

    const timeLimit  = data.timeLimit || gameRules.time || 20;
    const elapsed    = data.sentAt ? Math.min((Date.now() - data.sentAt) / 1000, timeLimit) : 0;
    const endAt      = Date.now() + (timeLimit - elapsed) * 1000;
    document.getElementById("p-timer").style.width = Math.max(0, (timeLimit - elapsed) / timeLimit * 100) + "%";
    window._pTI = setInterval(() => {
      const remaining = (endAt - Date.now()) / 1000;
      document.getElementById("p-timer").style.width = Math.max(0, remaining / timeLimit * 100) + "%";
      if (remaining <= 0.15) {
        clearInterval(window._pTI);
        document.getElementById("p-timer").style.width = "0%";
        if (!_plAnswered) {
          if (_plSelectedHid) plSubmitAnswer();
          else {
            _plAnswered = true;
            document.getElementById("pl-answer-btn").style.display = "none";
            document.getElementById("pl-flash").innerHTML = `<div class="flash ng">時間切れ</div>`;
          }
        }
      }
    }, 80);
  }

  if (data.type === "answer-result") {
    const f = document.getElementById("pl-flash");
    const r = gameRules;
    if      (data.correct && data.first) f.innerHTML = `<div class="flash first">早押し正解　+${r.pts+r.first}pt</div>`;
    else if (data.correct)               f.innerHTML = `<div class="flash ok">正解　+${r.pts}pt</div>`;
    else if (r.penalty > 0)              f.innerHTML = `<div class="flash ng">不正解　-${r.penalty}pt</div>`;
    else                                 f.innerHTML = `<div class="flash ng">不正解</div>`;
    if (data.scores) renderScores("pl-scores", data.scores);
  }

  if (data.type === "reveal") {
    clearInterval(window._pTI);
    document.getElementById("pl-flash").innerHTML = `<div class="flash ok">正解：${heroName(data.heroId)}</div>`;
    updateHeroList("pl-hero-picker", "", () => {}, { disabled:true, revealId:data.heroId });
    document.getElementById("pl-answer-btn").style.display = "none";
    setBadge(document.getElementById("pl-badge"), "待機中", "b-warn");
    if (data.scores) renderScores("pl-scores", data.scores);
  }

  if (data.type === "reset") {
    _plAnswered = false; _plSelectedHid = null; _plCurrentData = null;
    renderCards("pl-cards", [null, null, null, null]);
    document.getElementById("pl-hero-picker").innerHTML       = "";
    document.getElementById("pl-flash").innerHTML             = "";
    document.getElementById("pl-answer-btn").style.display    = "none";
    document.getElementById("p-timer").style.width            = "0%";
    document.getElementById("pl-quiz").style.display          = "block";
    setBadge(document.getElementById("pl-badge"), "待機中", "b-warn");
  }

  if (data.type === "game-end") {
    clearInterval(window._pTI);
    document.getElementById("pl-quiz").style.display  = "none";
    document.getElementById("pl-flash").innerHTML     = `<div class="flash first">ゲーム終了　優勝：${data.winner}</div>`;
    setBadge(document.getElementById("pl-badge"), "終了", "b-ok");
    if (data.scores) renderScores("pl-scores", data.scores);
  }

  if (data.type === "scores") renderScores("pl-scores", data.scores);
}

function plSubmitAnswer() {
  if (_plAnswered || !_plSelectedHid || !_plCurrentData) return;
  _plAnswered = true; clearInterval(window._pTI);
  const hid     = _plSelectedHid;
  const correct = _plCurrentData.heroId;
  const isFirst = !_plCurrentData._ans; _plCurrentData._ans = true;

  document.getElementById("pl-hero-picker-input").disabled   = true;
  document.getElementById("pl-answer-btn").style.display     = "none";
  updateHeroList("pl-hero-picker", "", () => {}, {
    disabled: true, correctId: correct,
    ...(hid !== correct && { wrongId: hid }),
  });

  if (_hostParticipating) {
    const r   = gameRules;
    const pts = hid === correct && isFirst ? r.pts + r.first : hid === correct ? r.pts : -r.penalty;
    scores[_plMyName] = Math.max(0, (scores[_plMyName] || 0) + pts);
    const ptLabel = hid === correct && isFirst ? `早押し+${r.pts+r.first}` : hid === correct ? `+${r.pts}` : r.penalty > 0 ? `-${r.penalty}` : "";
    addLog(`${hid===correct?"○":"×"} ${_plMyName}：${heroName(hid)}${ptLabel ? " "+ptLabel : ""}`);
    bcastScores();
    const f = document.getElementById("pl-flash");
    if      (hid === correct && isFirst) f.innerHTML = `<div class="flash first">早押し正解　+${r.pts+r.first}pt</div>`;
    else if (hid === correct)            f.innerHTML = `<div class="flash ok">正解　+${r.pts}pt</div>`;
    else if (r.penalty > 0)             f.innerHTML = `<div class="flash ng">不正解　-${r.penalty}pt</div>`;
    else                                f.innerHTML = `<div class="flash ng">不正解</div>`;
    renderScores("pl-scores", scores);
    if (r.goal > 0 && scores[_plMyName] >= r.goal) {
      bcast({ type:"game-end", winner:_plMyName, scores });
      setTimeout(() => { alert(`ゲーム終了　優勝：${_plMyName} (${scores[_plMyName]}pt)`); renderScores("host-scores", scores); }, 200);
    }
  } else {
    document.getElementById("pl-flash").innerHTML = `<div class="flash ${hid===correct?"first":"ng"}">回答を送信しました</div>`;
    hostConn.send({ type:"answer", heroId:hid, name:_plMyName, first:isFirst });
  }
}

function renderLobbyRules(rules) {
  rules = rules || {};
  const el = document.getElementById("ploby-rules");
  if (!el) return;
  el.innerHTML = `
    <div>制限時間：${rules.time||20}秒</div>
    <div>正解ポイント：${rules.pts||1}pt</div>
    <div>早押しボーナス：+${rules.first||0}pt</div>
    <div>誤答ペナルティ：-${rules.penalty||0}pt</div>
    <div>優勝ポイント：${rules.goal>0 ? rules.goal+"pt" : "なし（無制限）"}</div>`;
}

// --- 司会者：出題・発表 ---
let hostCards = [null,null,null,null], hostPickerSlot = -1;
let hostActiveFilters = new Set(), hostSelectedHero = null;

function initHostDeckBuilder() {
  hostCards = [null,null,null,null]; hostSelectedHero = null;
  [0,1,2,3].forEach(i => resetHostSlot(i));
  document.getElementById("host-picker-area").style.display = "none";
  buildHostFilterBtns();
  setupSlotDrops("hs", 4, (i, cid) => {
    if (isDuplicate(hostCards, cid, i)) { alert("同じカードはすでに使用されています"); return; }
    const card = cardInfo(cid); hostCards[i] = card; updateHostSlot(i, card);
  });
  renderHeroPicker("host-hero-picker", hid => {
    hostSelectedHero = hid;
    document.querySelectorAll("#host-hero-picker-list .hero-list-item")
      .forEach(el => el.classList.toggle("selected", el.dataset.hid === hid));
    document.getElementById("host-hero-picker-input").value = heroName(hid);
    document.getElementById("host-hero-picker-clear").classList.add("show");
  }, {});
}

function updateHostSlot(i, card) {
  const el = document.getElementById(`hs${i}`);
  el.className = "slot has";
  el.querySelector(".s-add").style.display = "none";
  el.querySelectorAll(".slot-ct").forEach(e => e.remove());
  const wrap = document.createElement("div");
  wrap.className = "slot-ct";
  wrap.innerHTML = renderCardTile(card.id);
  el.appendChild(wrap);
}
function resetHostSlot(i) {
  const el = document.getElementById(`hs${i}`);
  if (!el) return;
  el.className = "slot";
  el.querySelector(".s-add").style.display = "";
  el.querySelectorAll(".slot-ct").forEach(e => e.remove());
}
function clearHostSlot(e, i) { e.stopPropagation(); hostCards[i] = null; resetHostSlot(i); }

function openHostPicker(slot) {
  if (hostCards[slot]) { hostCards[slot] = null; resetHostSlot(slot); return; }
  hostPickerSlot = slot;
  document.getElementById("host-pick-label").textContent = `スロット${slot+1} のカードを選択`;
  document.getElementById("host-picker-area").style.display = "block";
  renderHostPickerGrid();
}

function buildHostFilterBtns() {
  document.getElementById("host-picker-filters").innerHTML =
    buildFilterHTML(FILTER_DEFS, "toggleHostFilter", "toggleHostCollabExpand", "resetHostFilters");
  const area = document.getElementById("host-collab-expand-area");
  if (area) area.innerHTML = getCollabNames().map(n =>
    `<button class="filt filt-collab" data-k="collab:${n}" onclick="toggleHostFilter('collab:${n}')">${n}</button>`
  ).join("");
}

function toggleHostFilter(k) {
  hostActiveFilters.has(k) ? hostActiveFilters.delete(k) : hostActiveFilters.add(k);
  document.querySelectorAll("#host-picker-filters .filt, #host-collab-expand-area .filt")
    .forEach(b => b.classList.toggle("on", hostActiveFilters.has(b.dataset.k)));
  const labels = [...hostActiveFilters].map(k => k.startsWith("collab:") ? k.slice(7) : k);
  document.getElementById("host-filter-hint").textContent = labels.length ? `フィルター: ${labels.join(" AND ")}` : "";
  renderHostPickerGrid();
}
function resetHostFilters() {
  hostActiveFilters.clear();
  document.querySelectorAll("#host-picker-filters .filt, #host-collab-expand-area .filt")
    .forEach(b => b.classList.remove("on"));
  document.getElementById("host-filter-hint").textContent = "";
  renderHostPickerGrid();
}
function toggleHostCollabExpand() {
  const area = document.getElementById("host-collab-expand-area");
  const btn  = document.querySelector("#host-picker-filters .filt-collab-toggle");
  if (!area) return;
  const open = area.style.display === "flex";
  area.style.display = open ? "none" : "flex";
  if (btn) btn.textContent = open ? "コラボ ▽" : "コラボ △";
}

function renderHostPickerGrid() {
  const filtered = applyFilters(CARDS, hostActiveFilters).slice(0, 200);
  document.getElementById("host-picker-count").textContent =
    `${filtered.length}件${filtered.length >= 200 ? " (200件まで表示)" : ""}`;
  document.getElementById("host-picker-grid").innerHTML = buildPickerHTML(filtered, "selectHostCard");
}

function selectHostCard(cardId) {
  if (isDuplicate(hostCards, cardId, hostPickerSlot)) { alert("同じカードはすでに使用されています"); return; }
  hostCards[hostPickerSlot] = cardInfo(cardId);
  updateHostSlot(hostPickerSlot, hostCards[hostPickerSlot]);
  const next = [0,1,2,3].find(i => i > hostPickerSlot && !hostCards[i]);
  if (next !== undefined) {
    hostPickerSlot = next;
    document.getElementById("host-pick-label").textContent = `スロット${next+1} のカードを選択`;
  } else {
    document.getElementById("host-picker-area").style.display = "none";
  }
}

function hostSend() {
  if (!hostSelectedHero)                    { alert("キャラを選択してください"); return; }
  if (hostCards.filter(Boolean).length < 4) { alert("4枚すべてのカードを選択してください"); return; }
  const cardIds   = hostCards.map(c => c.id);
  const timeLimit = gameRules.time || 20;
  hostCurDeck = { heroId:hostSelectedHero, cards:cardIds };
  bcast({ type:"question", cards:cardIds, heroId:hostSelectedHero, timeLimit, sentAt:Date.now() });

  // カード選択エリアを閉じる
  document.getElementById("host-picker-area").style.display = "none";

  document.getElementById("host-reveal").style.display = "block";
  document.getElementById("host-log").innerHTML = '<p style="color:var(--text3)">回答待ち...</p>';
  addLog(`出題：${heroName(hostSelectedHero)}`);
  clearTimeout(window._hostTimer);
  window._hostTimer = setTimeout(hostReveal, timeLimit * 1000);

  // ホスト参加中なら自分にも出題を適用
  if (_hostParticipating) {
    handlePlayer({ type:"question", cards:cardIds, heroId:hostSelectedHero, timeLimit, sentAt:Date.now() }, _plMyName);
  }
}

function hostReveal() {
  clearTimeout(window._hostTimer);
  if (!hostCurDeck) return;
  bcast({ type:"reveal", heroId:hostCurDeck.heroId, scores });
  document.getElementById("host-reveal").style.display = "none";
  renderScores("host-scores", scores);
  setTimeout(() => {
    hostCurDeck = null;
    hostCards = [null,null,null,null]; hostSelectedHero = null;
    [0,1,2,3].forEach(i => resetHostSlot(i));
    const inp = document.getElementById("host-hero-picker-input");
    const clr = document.getElementById("host-hero-picker-clear");
    if (inp) { inp.value = ""; inp.disabled = false; }
    if (clr) clr.classList.remove("show");
    updateHeroList("host-hero-picker", "", () => {}, {});
    bcast({ type:"reset" });
  }, REVEAL_RESET_DELAY);
}

// --- ユーティリティ ---
function bcast(msg)      { Object.values(playerConns).forEach(p => p.conn.send(msg)); }
function bcastScores()   { bcast({ type:"scores", scores }); renderScores("host-scores", scores); }
function updatePeers()   {
  const entries = Object.values(playerConns);
  document.getElementById("peer-count").textContent = entries.length;
  document.getElementById("peer-list").innerHTML = entries.length === 0
    ? '<span style="font-size:12px;color:var(--text3)">まだ誰もいません</span>'
    : entries.map(p => `<span class="peer-tag">${p.name||"接続中…"}</span>`).join("");
}
function addLog(msg) {
  const el = document.getElementById("host-log");
  const p  = document.createElement("p");
  p.textContent = msg;
  el.insertBefore(p, el.firstChild);
}
function setBadge(el, text, cls) {
  if (!el) return;
  el.textContent = text;
  el.className   = `badge ${cls}`;
}
function closePeer() {
  if (peer) { try { peer.destroy(); } catch(e) {} }
  peer = null; hostConn = null; playerConns = {};
}
function closeRoom() { closePeer(); }
