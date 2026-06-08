/* app.js — コンパス デッキ当てクイズ */
/* ===== データ ===== */
// element: fire/water/wood/none (cards.jsonのcolorから変換済み) / collab(string|null)
const EL_META={
  fire:{label:"火",cls:"fire"},
  water:{label:"水",cls:"water"},
  wood:{label:"木",cls:"wood"},
  none:{label:"無",cls:"none"},
};
const EL_META_COLLAB={label:"コラボ",cls:"collab"};
const RAR_META={ur:{label:"UR",cls:"ur"},sr:{label:"SR",cls:"sr"},r:{label:"R",cls:"r"}};
const ELEM_EMOJI={fire:"🔴",water:"🔵",wood:"🟢",none:"⚫"};
const RANK_ORDER={F:0,E:1,D:2,C:3,B:4,A:5,S:6};

let HEROES=[], CARDS=[], decks=[];



/* ===== ドラッグ＆ドロップ ===== */
let dragCardId=null;

function onPickCardDragStart(e,cardId){
  dragCardId=cardId;
  e.dataTransfer.effectAllowed="copy";
}

function initSlotDrop(slotEl, onDropFn){
  slotEl.addEventListener("dragover",e=>{
    e.preventDefault(); e.dataTransfer.dropEffect="copy";
    slotEl.classList.add("drag-over");
  });
  slotEl.addEventListener("dragleave",()=>slotEl.classList.remove("drag-over"));
  slotEl.addEventListener("drop",e=>{
    e.preventDefault(); slotEl.classList.remove("drag-over");
    if(dragCardId) onDropFn(dragCardId);
  });
}

function setupSlotDrops(prefix, slotCount, onDrop){
  for(let i=0;i<slotCount;i++){
    const el=document.getElementById(`${prefix}${i}`);
    if(el) initSlotDrop(el,(cid)=>onDrop(i,cid));
  }
}

/* ===== ユーザー名管理 ===== */
function loadUserName(){
  try{ userName=localStorage.getItem("cq_username")||""; }catch(e){}
  if(!userName){ openNameModal(); }
  else { applyUserName(); }
}
function applyUserName(){
  const el=document.getElementById("top-username");
  if(el) el.textContent="👤 "+userName;
  const rud=document.getElementById("room-username-display");
  if(rud) rud.textContent=userName;
}
function openNameModal(){
  const inp=document.getElementById("modal-name-input");
  if(inp) inp.value=userName;
  document.getElementById("name-modal").classList.add("open");
  setTimeout(()=>inp&&inp.focus(),100);
}
function handleModalClick(e){
  if(e.target===document.getElementById("name-modal")) closeNameModal();
}
function closeNameModal(){
  if(!userName) return; // 未設定なら閉じない
  document.getElementById("name-modal").classList.remove("open");
}
function saveUserName(){
  const v=document.getElementById("modal-name-input").value.trim();
  if(!v){ alert("名前を入力してください"); return; }
  userName=v;
  try{ localStorage.setItem("cq_username",userName); }catch(e){}
  document.getElementById("name-modal").classList.remove("open");
  applyUserName();
}
document.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&document.getElementById("name-modal").classList.contains("open")) saveUserName();
});

async function loadData(){
  let heroOk=false, cardOk=false;
  try{
    const r=await fetch("heroes.json");
    if(r.ok){ HEROES=await r.json(); heroOk=true; }
  }catch(e){}
  try{
    const r=await fetch("cards.json");
    if(r.ok){ const j=await r.json(); CARDS=j.cards||[]; cardOk=true; }
  }catch(e){}

  if(!heroOk||!cardOk){
    const missing=[];
    if(!heroOk) missing.push("heroes.json");
    if(!cardOk) missing.push("cards.json");
    document.getElementById("top-count").innerHTML=
      `<span style="color:var(--ng)">⚠ ${missing.join("・")} が読み込めませんでした。<br>同じフォルダに配置してください。</span>`;
  }

  try{ const raw=localStorage.getItem("cq_decks"); if(raw)decks=JSON.parse(raw); }catch(e){}
  loadUserName();
  refreshTop();
}

function saveDecks(){ try{localStorage.setItem("cq_decks",JSON.stringify(decks));}catch(e){} }

// カード情報を返す。collabフィールドを正しく扱う
function cardInfo(id){
  const f=CARDS.find(c=>c.id===id);
  if(f) return f;
  // JSONにない場合はIDから推測（collab=nullとして扱う）
  const m=id.match(/^([a-z]+)_(ur|sr|r)\d+$/);
  if(m) return {id, name:id, element:"none", rarity:m[2], collab:null};
  return {id, name:id, element:"f", rarity:"r", collab:null};
}

// カードの表示用属性メタを返す（collabフィールド優先）
function cardElMeta(card){
  // collabでもcolorベースの属性を返す
  return EL_META[card.element]||{label:card.element||"不明",cls:"none"};
}

function cardEmoji(card){
  return ELEM_EMOJI[card.element]||"⬜";
}

function heroName(id){ const h=HEROES.find(h=>h.id===id); return h?h.name:id; }

// cards.jsonに登録されているコラボ名一覧を動的取得
function getCollabNames(){
  const names=new Set();
  CARDS.forEach(c=>{ if(c.collab) names.add(c.collab); });
  return [...names].sort();
}


/* ===== 画面遷移 ===== */
function go(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if(id==="s-top")    refreshTop();
  if(id==="s-solo")   refreshSolo();
  if(id==="s-manage") initManage();
  if(id==="s-room"){ const rud=document.getElementById("room-username-display"); if(rud)rud.textContent=userName; }
}
function refreshTop(){
  document.getElementById("top-count").textContent=`${decks.length}件のデッキが登録されています`;
}
function refreshSolo(){
  const e=document.getElementById("solo-status"),b=document.getElementById("solo-go");
  if(decks.length===0){ e.textContent="デッキが0件です。先に「デッキを管理」から登録してください。"; b.disabled=true; }
  else{ e.textContent=`${decks.length}件のデッキが登録されています`; b.disabled=false; }
}

/* ===== カードタイル ===== */
function renderCardTile(cid){
  const c=cardInfo(cid), em=cardElMeta(c), rm=RAR_META[c.rarity]||{label:c.rarity,cls:"r"};
  const displayName=c.name&&c.name!==c.id ? c.name : c.id;
  const collabLabel = c.collab ? ` <span style="font-size:8px;opacity:.75">${c.collab}</span>` : "";
  const imgPath=`cards/${c.id}.jpg`;
  return `<div class="ct ${em.cls}">
    <img class="ct-img" src="${imgPath}" alt="${displayName}"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="ct-noimg" style="display:none">
      <div class="ct-id">${displayName}</div>
      <div class="ct-el">${cardEmoji(c)} ${em.label}${collabLabel}</div>
      <div class="ct-rar ${rm.cls}">${rm.label}</div>
    </div>
    <div class="ct-overlay">
      <div class="ct-id">${displayName}</div>
      <div class="ct-rar ${rm.cls}">${rm.label} ${em.label}${collabLabel}</div>
    </div>
  </div>`;
}
function renderCards(cid,ids){
  const tiles=(ids||[]).map(id=>id?renderCardTile(id):`<div class="ct empty">？</div>`);
  while(tiles.length<4) tiles.push(`<div class="ct empty">？</div>`);
  document.getElementById(cid).innerHTML=tiles.join("");
}

/* ===== ヒーロー検索ピッカー ===== */
// mode: "select"(管理) / "quiz"(クイズ回答)
// onSelect(heroId) コールバック
// containerId: 描画先のdiv id
// opts: { disabled, correctId, wrongId }
function renderHeroPicker(containerId, onSelect, opts={}){
  const wrap=document.getElementById(containerId);
  wrap.innerHTML=`
    <div class="hero-search-wrap">
      <input class="hero-search-input" id="${containerId}-input" placeholder="キャラ名を検索..." autocomplete="off">
      <button class="hero-search-clear" id="${containerId}-clear" onclick="clearHeroSearch('${containerId}')">✕</button>
    </div>
    <div class="hero-list" id="${containerId}-list" style="display:none"></div>`;

  const input=document.getElementById(`${containerId}-input`);
  const list=document.getElementById(`${containerId}-list`);

  // フォーカス時にリスト表示
  input.onfocus=()=>{
    list.style.display="block";
    updateHeroList(containerId,input.value,onSelect,opts);
  };
  input.oninput=()=>{
    const v=input.value;
    document.getElementById(`${containerId}-clear`).classList.toggle("show",v.length>0);
    list.style.display="block";
    updateHeroList(containerId,v,onSelect,opts);
  };
  // 外側クリックでリストを閉じる
  document.addEventListener("click",(e)=>{
    if(!wrap.contains(e.target)) list.style.display="none";
  },{capture:true});
}

function clearHeroSearch(containerId){
  const input=document.getElementById(`${containerId}-input`);
  const list=document.getElementById(`${containerId}-list`);
  // onSelectを保持したままリセット（空のコールバックで上書きしない）
  const savedOnSelect=list._onSelect||null;
  const savedOpts=list._opts||{};
  input.value="";
  document.getElementById(`${containerId}-clear`).classList.remove("show");
  // 選択済みキャラもリセット
  if(containerId==="mg-hero-picker") mgSelectedHero=null;
  if(containerId==="host-hero-picker") hostSelectedHero=null;
  updateHeroList(containerId,"",savedOnSelect,savedOpts);
  list.style.display="block";
  input.focus();
}

function updateHeroList(containerId, query, onSelect, opts={}){
  const list=document.getElementById(`${containerId}-list`);
  const q=query.trim().toLowerCase();
  const filtered=q
    ? HEROES.filter(h=>h.name.toLowerCase().includes(q)||h.id.toLowerCase().includes(q))
    : HEROES;

  if(filtered.length===0){
    list.innerHTML=`<div class="hero-list-empty">「${query}」は見つかりません</div>`;
    return;
  }

  list.innerHTML=filtered.map(h=>{
    let cls="";
    if(opts.correctId===h.id) cls="correct";
    else if(opts.wrongId===h.id) cls="wrong";
    else if(opts.revealId===h.id) cls="reveal";
    const disabled=opts.disabled||false;
    return `<div class="hero-list-item ${cls}${disabled?" disabled":""}" data-hid="${h.id}" onclick="${disabled?"":`heroListClick('${containerId}','${h.id}')`}">
      ${h.name}
    </div>`;
  }).join("");

  // コールバックとoptsを保存
  list._onSelect=onSelect;
  list._opts=opts;
}

function heroListClick(containerId,hid){
  const list=document.getElementById(`${containerId}-list`);
  const onSelect=list._onSelect;
  if(onSelect) onSelect(hid);
}

/* ===== ソロモード ===== */
let soloScore=0,soloIdx=0,soloOrder=[],soloAnswered=false,soloTI=null;
let soloCorrectId=null;

function startSolo(){
  if(decks.length===0){ go("s-manage"); return; }
  soloScore=0; soloIdx=0;
  soloOrder=[...decks].sort(()=>Math.random()-.5).slice(0,Math.min(10,decks.length));
  document.getElementById("qtot").textContent=soloOrder.length;
  showQ(); go("s-quiz");
}

function showQ(){
  clearInterval(soloTI); soloAnswered=false;
  const deck=soloOrder[soloIdx]; soloCorrectId=deck.heroId;
  document.getElementById("qnum").textContent=soloIdx+1;
  document.getElementById("sscore").textContent=soloScore;
  document.getElementById("sq-flash").innerHTML="";
  document.getElementById("sq-next").style.display="none";
  renderCards("sq-cards",deck.cards);

  // ヒーロー検索ピッカー（クイズモード）
  renderHeroPicker("sq-hero-picker",(hid)=>{
    if(soloAnswered) return;
    soloAnswered=true; clearInterval(soloTI);
    const correct=soloCorrectId;
    const flash=document.getElementById("sq-flash");
    const name=heroName(correct);
    // 選択結果を表示
    if(hid===correct){
      soloScore++;
      document.getElementById("sscore").textContent=soloScore;
      flash.innerHTML=`<div class="flash ok">✓ 正解！ ${name}</div>`;
      updateHeroList("sq-hero-picker","",()=>{},{disabled:true,correctId:correct});
    } else {
      flash.innerHTML=`<div class="flash ng">✗ 不正解。正解は「${name}」</div>`;
      updateHeroList("sq-hero-picker","",()=>{},{disabled:true,correctId:correct,wrongId:hid});
    }
    document.getElementById("sq-hero-picker-input").disabled=true;
    document.getElementById("sq-next").style.display="block";
  },{});

  let t=15; document.getElementById("s-timer").style.width="100%";
  soloTI=setInterval(()=>{
    t-=0.1; document.getElementById("s-timer").style.width=Math.max(0,t/15*100)+"%";
    if(t<=0){
      clearInterval(soloTI);
      if(!soloAnswered){
        soloAnswered=true;
        const correct=soloCorrectId;
        document.getElementById("sq-flash").innerHTML=`<div class="flash ng">⏱ 時間切れ。正解は「${heroName(correct)}」</div>`;
        updateHeroList("sq-hero-picker","",()=>{},{disabled:true,revealId:correct});
        document.getElementById("sq-hero-picker-input").disabled=true;
        document.getElementById("sq-next").style.display="block";
      }
    }
  },100);
}

function soloNext(){
  soloIdx++;
  if(soloIdx>=soloOrder.length){
    clearInterval(soloTI);
    const pct=Math.round(soloScore/soloOrder.length*100);
    document.getElementById("res-score").textContent=`${soloScore} / ${soloOrder.length}`;
    document.getElementById("res-sub").textContent=`正答率 ${pct}%`;
    let emoji="😔",title="もう少し練習しよう！";
    if(pct>=80){emoji="🏆";title="コンパス博士！";}
    else if(pct>=60){emoji="👍";title="なかなかいい感じ！";}
    else if(pct>=40){emoji="🙂";title="半分以上正解！";}
    document.getElementById("res-emoji").textContent=emoji;
    document.getElementById("res-title").textContent=title;
    go("s-result"); return;
  }
  showQ();
}

/* ===== デッキ管理 ===== */
let mgCards=[null,null,null,null], pickerSlot=-1;
let activeFilters=new Set(); // AND複数フィルター
let mgSelectedHero=null;

function initManage(){
  mgCards=[null,null,null,null]; mgSelectedHero=null;
  [0,1,2,3].forEach(i=>resetSlotEl(i));
  document.getElementById("mg-name").value="";
  document.getElementById("picker-area").style.display="none";
  activeFilters=new Set();

  // キャラ選択ピッカー
  renderHeroPicker("mg-hero-picker",(hid)=>{
    mgSelectedHero=hid;
    // 選択状態を視覚的に反映
    document.querySelectorAll("#mg-hero-picker-list .hero-list-item").forEach(el=>{
      el.classList.toggle("selected",el.dataset.hid===hid);
    });
    const input=document.getElementById("mg-hero-picker-input");
    input.value=heroName(hid);
    document.getElementById("mg-hero-picker-clear").classList.add("show");
  },{});

  buildFilterBtns();
  renderMgList();
  // ドラッグ＆ドロップ設定（管理画面スロット）
  setupSlotDrops("ms",4,(i,cid)=>{
    const card=cardInfo(cid); mgCards[i]=card; updateSlotEl(i,card);
  });
}

/* カードフィルター複数AND */
// FILTER_DEFSはloadData後に動的生成（コラボ名フィルターをcards.jsonから取得）
let FILTER_DEFS=[];

function buildFilterDefs(){
  const base=[
    {k:"ur",type:"rarity",l:"UR"},{k:"sr",type:"rarity",l:"SR"},{k:"r",type:"rarity",l:"R"},
    {k:"fire",type:"element",l:"🔴 火"},{k:"water",type:"element",l:"🔵 水"},
    {k:"wood",type:"element",l:"🟢 木"},{k:"none",type:"element",l:"⚫ 無"},
  ];
  FILTER_DEFS=base;
}

function buildFilterBtns(){
  buildFilterDefs();
  const collabNames=getCollabNames();
  const collabExpanded=document.getElementById("collab-expand-area");
  // 基本フィルター
  document.getElementById("picker-filters").innerHTML=
    FILTER_DEFS.map(f=>`<button class="filt" data-k="${f.k}" onclick="toggleFilter('${f.k}')">${f.l}</button>`).join("")
    +`<button class="filt filt-collab-toggle" onclick="toggleCollabExpand()">🟣 コラボ ▽</button>`
    +`<button class="filt-reset" onclick="resetFilters()">リセット</button>`;
  // コラボ展開エリアを構築
  if(collabExpanded){
    collabExpanded.innerHTML=collabNames.map(n=>
      `<button class="filt filt-collab" data-k="collab:${n}" onclick="toggleFilter('collab:${n}')">${n}</button>`
    ).join("");
  }
  updateFilterHint();
}

function toggleCollabExpand(){
  const area=document.getElementById("collab-expand-area");
  const btn=document.querySelector(".filt-collab-toggle");
  if(!area) return;
  const open=area.style.display==="flex";
  area.style.display=open?"none":"flex";
  btn.textContent=open?"🟣 コラボ ▽":"🟣 コラボ △";
}

function toggleFilter(k){
  if(activeFilters.has(k)) activeFilters.delete(k);
  else activeFilters.add(k);
  document.querySelectorAll("#picker-filters .filt").forEach(b=>{
    b.classList.toggle("on",activeFilters.has(b.dataset.k));
  });
  updateFilterHint();
  renderPickerGrid();
}

function resetFilters(){
  activeFilters.clear();
  document.querySelectorAll("#picker-filters .filt").forEach(b=>b.classList.remove("on"));
  updateFilterHint();
  renderPickerGrid();
}

function updateFilterHint(){
  const h=document.getElementById("filter-hint");
  if(activeFilters.size===0){ h.textContent=""; return; }
  const labels=[...activeFilters].map(k=>{
    if(k==="collab") return "コラボ全て";
    if(k.startsWith("collab:")) return k.slice(7);
    return FILTER_DEFS.find(f=>f.k===k)?.l||k;
  });
  h.textContent=`フィルター: ${labels.join(" AND ")}`;
}

function applyFilters(list){
  if(activeFilters.size===0) return list;
  // レアリティ・属性・コラボを分類
  const rarFilters=[...activeFilters].filter(k=>k==="ur"||k==="sr"||k==="r");
  const elFilters=[...activeFilters].filter(k=>k==="fire"||k==="water"||k==="wood"||k==="none");
  const collabAll=activeFilters.has("collab");
  const collabNames=[...activeFilters].filter(k=>k.startsWith("collab:")).map(k=>k.slice(7));
  return list.filter(c=>{
    // レアリティ: AND（複数選択時はいずれかに一致）
    if(rarFilters.length>0 && !rarFilters.includes(c.rarity)) return false;
    // 属性: OR（いずれかに一致すればOK）
    if(elFilters.length>0 && !elFilters.includes(c.element)) return false;
    // コラボ全体
    if(collabAll && !c.collab) return false;
    // 特定コラボ: OR
    if(collabNames.length>0 && !collabNames.includes(c.collab)) return false;
    return true;
  });
}

function openPicker(slot){
  pickerSlot=slot;
  document.getElementById("pick-label").textContent=`スロット${slot+1} のカードを選択`;
  document.getElementById("picker-area").style.display="block";
  renderPickerGrid();
}

function sortedCards(){
  return [...CARDS].sort((a,b)=>{
    if(a.rank&&b.rank) return (RANK_ORDER[a.rank]||0)-(RANK_ORDER[b.rank]||0);
    if(a.rank&&!b.rank) return -1;
    if(!a.rank&&b.rank) return 1;
    return (a.collab||"").localeCompare(b.collab||"");
  });
}

function buildPickerHTML(filtered, onClickFn){
  let out="", lastGroup="";
  for(const card of filtered){
    const group=card.rank ? `${card.rank}ランク` : (card.collab||"コラボ");
    if(group!==lastGroup){
      out+=`<div class="card-sep"><div class="card-sep-line"></div><div class="card-sep-label">${group}</div><div class="card-sep-line"></div></div>`;
      lastGroup=group;
    }
    const em=cardElMeta(card), rm=RAR_META[card.rarity]||{label:card.rarity,cls:"r"};
    const displayName=card.name&&card.name!==card.id?card.name:card.id;
    out+=`<div class="pick-card" draggable="true" onclick="${onClickFn}('${card.id}')" ondragstart="onPickCardDragStart(event,'${card.id}')">
      <img class="pc-img" src="cards/${card.id}.jpg" alt="${displayName}"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="pc-noimg" style="display:none;width:100%;aspect-ratio:0.72;align-items:center;justify-content:center;font-size:20px;background:var(--bg3)">${cardEmoji(card)}</div>
      <div class="pc-id">${displayName}</div>
      <div class="pc-rar ${rm.cls}">${rm.label} ${em.label}</div>
    </div>`;
  }
  return out;
}

function renderPickerGrid(){
  const g=document.getElementById("picker-grid");
  const filtered=applyFilters(sortedCards()).slice(0,200);
  document.getElementById("picker-count").textContent=`${filtered.length}件${filtered.length>=200?" (200件まで表示)":""}`;
  g.innerHTML=buildPickerHTML(filtered,"selectCard");
}

function selectCard(cardId){
  const card=cardInfo(cardId);
  mgCards[pickerSlot]=card;
  updateSlotEl(pickerSlot,card);
  document.getElementById("picker-area").style.display="none";
}

function updateSlotEl(i,card){
  const el=document.getElementById(`ms${i}`);
  el.className="slot has";
  el.querySelector(".s-add").style.display="none";
  el.querySelectorAll(".slot-ct").forEach(e=>e.remove());
  // renderCardTileと同じ構造をslot内に挿入
  const wrap=document.createElement("div");
  wrap.className="slot-ct";
  wrap.innerHTML=renderCardTile(card.id);
  el.appendChild(wrap);
}

function resetSlotEl(i){
  const el=document.getElementById(`ms${i}`);
  el.className="slot"; el.querySelector(".s-add").style.display="";
  el.querySelectorAll(".slot-ct").forEach(e=>e.remove());
}
function clearSlot(e,i){ e.stopPropagation(); mgCards[i]=null; resetSlotEl(i); }

function mgSave(){
  if(!mgSelectedHero){ alert("キャラを選択してください"); return; }
  if(mgCards.filter(Boolean).length<4){ alert("4枚すべてのカードを選択してください"); return; }
  const name=document.getElementById("mg-name").value.trim();
  if(!name){ alert("デッキ名を入力してください"); return; }
  decks.push({id:Date.now(),heroId:mgSelectedHero,cards:mgCards.map(c=>c.id),name});
  saveDecks(); initManage();
}

function renderMgList(){
  const el=document.getElementById("mg-list");
  if(decks.length===0){
    el.innerHTML='<p style="font-size:13px;color:var(--text3);padding:10px 0">まだデッキがありません</p>';
    return;
  }
  el.innerHTML=decks.map(d=>{
    const chips=(d.cards||[]).map(cid=>`<span class="deck-card-chip">${cid}</span>`).join("");
    return `<div class="deck-item">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${heroName(d.heroId)}</div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:4px">${d.name}</div>
        <div class="deck-cards">${chips}</div>
      </div>
      <button class="btn-sm btn-danger" onclick="deleteDeck(${d.id})" style="flex-shrink:0">削除</button>
    </div>`;
  }).join("");
}
function deleteDeck(id){ decks=decks.filter(d=>d.id!==id); saveDecks(); renderMgList(); refreshTop(); }

/* ===== P2P ===== */
let peer=null,hostConn=null,playerConns={};
let scores={},hostCurDeck=null,selectedHostId=null;
let userName="";

function createRoom(){
  const myName=userName||"司会者";
  const rawPP=(document.getElementById("room-passphrase").value.trim()||"").toLowerCase().replace(/\s+/g,"");
  if(!rawPP){ alert("合言葉を入力してください"); return; }
  scores={}; scores[myName]=0; closePeer();
  peer=new Peer("cq-room-"+rawPP,{debug:0});
  peer.on("open",()=>{
    document.getElementById("room-passphrase-display").textContent=rawPP;
    document.getElementById("peer-count").textContent="0";
    document.getElementById("peer-list").innerHTML="";
    document.getElementById("host-log").innerHTML='<p style="color:var(--text3)">まだ回答がありません</p>';
    initHostDeckBuilder(); go("s-host");
  });
  peer.on("connection",conn=>{
    playerConns[conn.peer]=conn;
    conn.on("open",()=>{ conn.send({type:"welcome",hostName:myName}); updatePeers(); });
    conn.on("data",d=>handleHost(d,conn));
    conn.on("close",()=>{ delete playerConns[conn.peer]; updatePeers(); });
  });
  peer.on("error",e=>alert("接続エラー: "+e.message));
}

function joinRoom(){
  const rawPP=(document.getElementById("join-id").value.trim()||"").toLowerCase().replace(/\s+/g,"");
  if(!rawPP){ alert("合言葉を入力してください"); return; }
  const myName=userName||"プレイヤー";
  closePeer();
  peer=new Peer(undefined,{debug:0});
  peer.on("open",()=>{
    hostConn=peer.connect("cq-room-"+rawPP);
    hostConn.on("open",()=>{
      hostConn.send({type:"join",name:myName});
      document.getElementById("pl-badge").textContent="接続済み";
      document.getElementById("pl-badge").className="badge b-ok";
      document.getElementById("pl-quiz").style.display="none";
      go("s-player");
    });
    hostConn.on("data",d=>handlePlayer(d,myName));
    hostConn.on("close",()=>{ document.getElementById("pl-badge").textContent="切断"; document.getElementById("pl-badge").className="badge b-ng"; });
    hostConn.on("error",()=>alert("接続できませんでした。IDを確認してください"));
  });
  peer.on("error",e=>alert("接続エラー: "+e.message));
}

function handleHost(data,conn){
  if(data.type==="join"){
    if(!scores[data.name])scores[data.name]=0;
    addLog(`✅ ${data.name} が参加`); updatePeers(); bcastScores();
  }
  if(data.type==="answer"){
    const correct=hostCurDeck&&data.heroId===hostCurDeck.heroId;
    const pts=correct&&data.first?3:correct?1:0;
    if(!scores[data.name])scores[data.name]=0;
    scores[data.name]+=pts;
    addLog(`${correct?"✓":"✗"} ${data.name}：${heroName(data.heroId)}${data.first&&correct?" 🏆+3":correct?" +1":""}`);
    bcastScores();
    conn.send({type:"answer-result",correct,first:data.first,scores});
  }
}

let _plAnswered=false;
function handlePlayer(data,myName){
  if(data.type==="welcome") document.getElementById("pl-sub").textContent=`司会者: ${data.hostName}`;
  if(data.type==="question"){
    _plAnswered=false; clearInterval(window._pTI);
    document.getElementById("pl-badge").textContent="出題中";
    document.getElementById("pl-badge").className="badge b-warn";
    document.getElementById("pl-flash").innerHTML="";
    document.getElementById("pl-quiz").style.display="block";
    renderCards("pl-cards",data.cards);

    renderHeroPicker("pl-hero-picker",(hid)=>{
      if(_plAnswered) return; _plAnswered=true; clearInterval(window._pTI);
      const correct=data.heroId;
      const isFirst=!data._ans; data._ans=true;
      hostConn.send({type:"answer",heroId:hid,name:myName,first:isFirst});
      document.getElementById("pl-hero-picker-input").disabled=true;
      if(hid===correct){
        document.getElementById("pl-flash").innerHTML=`<div class="flash first">⚡ 回答送信！正解かも…</div>`;
        updateHeroList("pl-hero-picker","",()=>{},{disabled:true,correctId:correct});
      } else {
        document.getElementById("pl-flash").innerHTML=`<div class="flash ng">✗ 回答送信…</div>`;
        updateHeroList("pl-hero-picker","",()=>{},{disabled:true,correctId:correct,wrongId:hid});
      }
    },{});

    let t=20; document.getElementById("p-timer").style.width="100%";
    window._pTI=setInterval(()=>{
      t-=0.1; document.getElementById("p-timer").style.width=Math.max(0,t/20*100)+"%";
      if(t<=0) clearInterval(window._pTI);
    },100);
  }
  if(data.type==="answer-result"){
    const f=document.getElementById("pl-flash");
    if(data.correct&&data.first) f.innerHTML=`<div class="flash first">🏆 1番乗り正解！ +3pt</div>`;
    else if(data.correct)        f.innerHTML=`<div class="flash ok">✓ 正解！ +1pt</div>`;
    else                         f.innerHTML=`<div class="flash ng">✗ 不正解</div>`;
    if(data.scores) renderScores("pl-scores",data.scores);
  }
  if(data.type==="reveal"){
    clearInterval(window._pTI);
    document.getElementById("pl-flash").innerHTML=`<div class="flash ok">👁 正解：${heroName(data.heroId)}</div>`;
    updateHeroList("pl-hero-picker","",()=>{},{disabled:true,revealId:data.heroId});
    document.getElementById("pl-badge").textContent="待機中"; document.getElementById("pl-badge").className="badge b-warn";
    if(data.scores) renderScores("pl-scores",data.scores);
  }
  if(data.type==="scores") renderScores("pl-scores",data.scores);
}

function renderScores(cid,sc){
  if(!sc) return;
  const sorted=Object.entries(sc).sort((a,b)=>b[1]-a[1]);
  document.getElementById(cid).innerHTML=`<div class="lbl" style="margin-top:10px">スコア</div>`
    +sorted.map(([n,p],i)=>`<div class="score-row"><span>${i===0?"🥇":i===1?"🥈":i===2?"🥉":"　"} ${n}</span><span class="score-pts">${p}pt</span></div>`).join("");
}

// ホスト用リアルタイムデッキ編成
let hostCards=[null,null,null,null], hostPickerSlot=-1, hostPickerFilter="all";
let hostActiveFilters=new Set(), hostSelectedHero=null;

function initHostDeckBuilder(){
  hostCards=[null,null,null,null]; hostSelectedHero=null;
  [0,1,2,3].forEach(i=>resetHostSlot(i));
  document.getElementById("host-picker-area").style.display="none";
  buildHostFilterBtns();
  // ドラッグ＆ドロップ設定（司会者スロット）
  setupSlotDrops("hs",4,(i,cid)=>{
    const card=cardInfo(cid); hostCards[i]=card; updateHostSlot(i,card);
  });
  renderHeroPicker("host-hero-picker",(hid)=>{
    hostSelectedHero=hid;
    document.querySelectorAll("#host-hero-picker-list .hero-list-item").forEach(el=>{
      el.classList.toggle("selected",el.dataset.hid===hid);
    });
    const inp=document.getElementById("host-hero-picker-input");
    inp.value=heroName(hid);
    document.getElementById("host-hero-picker-clear").classList.add("show");
  },{});
}

function buildHostFilterBtns(){
  const collabNames=getCollabNames();
  const base=[
    {k:"ur",l:"UR"},{k:"sr",l:"SR"},{k:"r",l:"R"},
    {k:"fire",l:"🔴 火"},{k:"water",l:"🔵 水"},{k:"wood",l:"🟢 木"},{k:"none",l:"⚫ 無"},
  ];
  document.getElementById("host-picker-filters").innerHTML=
    base.map(f=>`<button class="filt" data-k="${f.k}" onclick="toggleHostFilter('${f.k}')">${f.l}</button>`).join("")
    +`<button class="filt filt-collab-toggle" onclick="toggleHostCollabExpand()">🟣 コラボ ▽</button>`
    +`<button class="filt-reset" onclick="resetHostFilters()">リセット</button>`;
  const area=document.getElementById("host-collab-expand-area");
  if(area) area.innerHTML=collabNames.map(n=>
    `<button class="filt filt-collab" data-k="collab:${n}" onclick="toggleHostFilter('collab:${n}')">${n}</button>`
  ).join("");
}

function toggleHostFilter(k){
  if(hostActiveFilters.has(k)) hostActiveFilters.delete(k);
  else hostActiveFilters.add(k);
  document.querySelectorAll("#host-picker-filters .filt, #host-collab-expand-area .filt").forEach(b=>{
    b.classList.toggle("on", hostActiveFilters.has(b.dataset.k));
  });
  const labels=[...hostActiveFilters].map(k=>k.startsWith("collab:")?k.slice(7):k);
  document.getElementById("host-filter-hint").textContent=labels.length?`フィルター: ${labels.join(" AND ")}`:"";
  renderHostPickerGrid();
}
function resetHostFilters(){
  hostActiveFilters.clear();
  document.querySelectorAll("#host-picker-filters .filt, #host-collab-expand-area .filt").forEach(b=>b.classList.remove("on"));
  document.getElementById("host-filter-hint").textContent="";
  renderHostPickerGrid();
}
function toggleHostCollabExpand(){
  const area=document.getElementById("host-collab-expand-area");
  const btn=document.querySelector("#host-picker-filters .filt-collab-toggle");
  if(!area) return;
  const open=area.style.display==="flex";
  area.style.display=open?"none":"flex";
  if(btn) btn.textContent=open?"🟣 コラボ ▽":"🟣 コラボ △";
}

function openHostPicker(slot){
  hostPickerSlot=slot;
  document.getElementById("host-pick-label").textContent=`スロット${slot+1} のカードを選択`;
  document.getElementById("host-picker-area").style.display="block";
  renderHostPickerGrid();
}

function renderHostPickerGrid(){
  const g=document.getElementById("host-picker-grid");
  const filtered=applyHostFilters(sortedCards()).slice(0,200);
  document.getElementById("host-picker-count").textContent=`${filtered.length}件${filtered.length>=200?" (200件まで表示)":""}`;
  g.innerHTML=buildPickerHTML(filtered,"selectHostCard");
}

function applyHostFilters(list){
  if(hostActiveFilters.size===0) return list;
  const rarFilters=[...hostActiveFilters].filter(k=>k==="ur"||k==="sr"||k==="r");
  const elFilters=[...hostActiveFilters].filter(k=>k==="fire"||k==="water"||k==="wood"||k==="none");
  const collabAll=hostActiveFilters.has("collab");
  const collabNames=[...hostActiveFilters].filter(k=>k.startsWith("collab:")).map(k=>k.slice(7));
  return list.filter(c=>{
    if(rarFilters.length>0 && !rarFilters.includes(c.rarity)) return false;
    if(elFilters.length>0 && !elFilters.includes(c.element)) return false;
    if(collabAll && !c.collab) return false;
    if(collabNames.length>0 && !collabNames.includes(c.collab)) return false;
    return true;
  });
}

function selectHostCard(cardId){
  const card=cardInfo(cardId);
  hostCards[hostPickerSlot]=card;
  updateHostSlot(hostPickerSlot,card);
  document.getElementById("host-picker-area").style.display="none";
}

function updateHostSlot(i,card){
  const el=document.getElementById(`hs${i}`);
  el.className="slot has";
  el.querySelector(".s-add").style.display="none";
  el.querySelectorAll(".slot-ct").forEach(e=>e.remove());
  const wrap=document.createElement("div");
  wrap.className="slot-ct";
  wrap.innerHTML=renderCardTile(card.id);
  el.appendChild(wrap);
}
function resetHostSlot(i){
  const el=document.getElementById(`hs${i}`);
  if(!el) return;
  el.className="slot"; el.querySelector(".s-add").style.display="";
  el.querySelectorAll(".slot-ct").forEach(e=>e.remove());
}
function clearHostSlot(e,i){ e.stopPropagation(); hostCards[i]=null; resetHostSlot(i); }
function hostSend(){
  if(!hostSelectedHero){ alert("キャラを選択してください"); return; }
  if(hostCards.filter(Boolean).length<4){ alert("4枚すべてのカードを選択してください"); return; }
  const cardIds=hostCards.map(c=>c.id);
  hostCurDeck={heroId:hostSelectedHero, cards:cardIds};
  Object.values(playerConns).forEach(c=>c.send({type:"question",cards:cardIds,heroId:hostSelectedHero}));
  document.getElementById("host-reveal").style.display="block";
  document.getElementById("host-log").innerHTML='<p style="color:var(--text3)">回答待ち...</p>';
  addLog(`📤 出題：${heroName(hostSelectedHero)}`);
}
function hostReveal(){
  if(!hostCurDeck) return;
  Object.values(playerConns).forEach(c=>c.send({type:"reveal",heroId:hostCurDeck.heroId,scores}));
  document.getElementById("host-reveal").style.display="none";
  renderScores("host-scores",scores);
}
function bcastScores(){ Object.values(playerConns).forEach(c=>c.send({type:"scores",scores})); renderScores("host-scores",scores); }
function updatePeers(){
  const cnt=Object.keys(playerConns).length;
  document.getElementById("peer-count").textContent=cnt;
  document.getElementById("peer-list").innerHTML=cnt===0
    ?'<span style="font-size:12px;color:var(--text3)">まだ誰もいません</span>'
    :Object.keys(playerConns).map(id=>`<span class="peer-tag">${id.slice(0,8)}…</span>`).join("");
}
function addLog(msg){ const el=document.getElementById("host-log"),p=document.createElement("p"); p.textContent=msg; el.insertBefore(p,el.firstChild); }
function copyId(){
  navigator.clipboard.writeText(document.getElementById("room-id").textContent).then(()=>{
    const b=event.target,o=b.textContent; b.textContent="コピー済み ✓"; setTimeout(()=>b.textContent=o,2000);
  });
}
function copyPassphrase(){
  const pp=document.getElementById("room-passphrase-display").textContent;
  if(!pp) return;
  navigator.clipboard.writeText(pp).then(()=>{
    const btn=event.target; const orig=btn.innerHTML;
    btn.innerHTML="✓ コピー済み";
    setTimeout(()=>btn.innerHTML=orig,2000);
  });
}
function closePeer(){ if(peer){try{peer.destroy();}catch(e){}} peer=null; hostConn=null; playerConns={}; }
function closeRoom(){ closePeer(); }

loadData();