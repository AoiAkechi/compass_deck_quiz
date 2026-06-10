/* data.js — 定数・データアクセス */

const EL_META = {
  fire:  { label:"火", cls:"fire"  },
  water: { label:"水", cls:"water" },
  wood:  { label:"木", cls:"wood"  },
  none:  { label:"無", cls:"none"  },
};
const RAR_META = {
  ur: { label:"UR", cls:"ur" },
  sr: { label:"SR", cls:"sr" },
  r:  { label:"R",  cls:"r"  },
};
const ELEM_EMOJI = { fire:"🔴", water:"🔵", wood:"🟢", none:"⚫" };

const FILTER_DEFS = [
  {k:"ur",   type:"rarity",   l:"UR"},
  {k:"sr",   type:"rarity",   l:"SR"},
  {k:"r",    type:"rarity",   l:"R"},
  {k:"fire", type:"element",  l:"🔴 火"},
  {k:"water",type:"element",  l:"🔵 水"},
  {k:"wood", type:"element",  l:"🟢 木"},
  {k:"none", type:"element",  l:"⚫ 無"},
  {k:"type:強",type:"cardtype",l:"強"},
  {k:"type:近",type:"cardtype",l:"近"},
  {k:"type:遠",type:"cardtype",l:"遠"},
  {k:"type:防",type:"cardtype",l:"防"},
  {k:"type:移",type:"cardtype",l:"移"},
  {k:"type:癒",type:"cardtype",l:"癒"},
  {k:"type:弱",type:"cardtype",l:"弱"},
  {k:"type:反",type:"cardtype",l:"反"},
  {k:"type:周",type:"cardtype",l:"周"},
  {k:"type:連",type:"cardtype",l:"連"},
  {k:"type:罠",type:"cardtype",l:"罠"},
  {k:"type:他",type:"cardtype",l:"他"},
];

let HEROES = [], CARDS = [], decks = [];

function cardInfo(id) {
  return CARDS.find(c => c.id === id) || { id, name:id, element:"none", rarity:"r", collab:null };
}
function cardElMeta(card) {
  return EL_META[card.element] || { label:card.element||"不明", cls:"none" };
}
function cardEmoji(card) {
  return ELEM_EMOJI[card.element] || "⬜";
}
function heroName(id) {
  const h = HEROES.find(h => h.id === id);
  return h ? h.name : id;
}
function getCollabNames() {
  const names = new Set();
  CARDS.forEach(c => { if (c.collab) names.add(c.collab); });
  return [...names];
}
function saveDecks() {
  try { localStorage.setItem("cq_decks", JSON.stringify(decks)); } catch(e) {}
}

async function loadData() {
  let heroOk = false, cardOk = false;
  try { const r = await fetch("heroes.json"); if (r.ok) { HEROES = await r.json(); heroOk = true; } } catch(e) {}
  try { const r = await fetch("cards.json");  if (r.ok) { const j = await r.json(); CARDS = j.cards||[]; cardOk = true; } } catch(e) {}

  if (!heroOk || !cardOk) {
    const missing = [!heroOk&&"heroes.json", !cardOk&&"cards.json"].filter(Boolean);
    document.getElementById("top-count").innerHTML =
      `<span style="color:var(--ng)">⚠ ${missing.join("・")} が読み込めませんでした。同じフォルダに配置してください。</span>`;
  }

  try { const raw = localStorage.getItem("cq_decks"); if (raw) decks = JSON.parse(raw); } catch(e) {}
  loadUserName();
  initTouchDrag();
  refreshTop();
  loadQLists();
}