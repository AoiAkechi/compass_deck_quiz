// firebase-sync.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, setDoc,
  serverTimestamp, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPqieL2u8-u85yLGsILCl-UZvoHOe0kkc",
  authDomain: "compass-deck-quiz.firebaseapp.com",
  projectId: "compass-deck-quiz",
  storageBucket: "compass-deck-quiz.firebasestorage.app",
  messagingSenderId: "181144518371",
  appId: "1:181144518371:web:e0ba03752a82c937f74fd6"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// cards.json を読み込んでカード名を解決する
let cardsCache = null;
async function getCardName(cardId) {
  if (!cardsCache) {
    try {
      const res = await fetch("cards.json");
      const j = await res.json();
      cardsCache = j.cards || [];
    } catch (e) {
      console.warn("[firebase-sync] cards.json の読み込み失敗:", e);
      cardsCache = [];
    }
  }
  const card = cardsCache.find(c => c.id === cardId);
  return card ? card.name : cardId;
}

let heroesCache = null;
async function getHeroName(heroId) {
  if (!heroesCache) {
    try {
      const res = await fetch("heroes.json");
      heroesCache = await res.json();
    } catch (e) {
      heroesCache = [];
    }
  }
  const hero = heroesCache.find(h => h.id === heroId);
  return hero ? hero.name : heroId;
}

// デッキ保存（カードIDとカード名の両方を保存）
async function saveDeckToFirebase(deck) {
  const userName = localStorage.getItem("cq_username") || "名無し";
  const heroName = await getHeroName(deck.heroId);
  const cardNames = await Promise.all((deck.cards || []).map(id => getCardName(id)));
  await addDoc(collection(db, "decks"), {
    userName,
    deckName:  deck.name || "名称未設定",
    heroId:    deck.heroId  || null,
    heroName,
    cards:     deck.cards   || [],
    cardNames,
    createdAt: serverTimestamp()
  });
  console.log("[firebase-sync] デッキ保存完了:", deck.name, "/", heroName);
}

// 問題リストをFirebaseに公開
window.fbPublishList = async function(listName, deckIds) {
  try {
    const raw = localStorage.getItem("cq_decks");
    const allDecks = raw ? JSON.parse(raw) : [];
    const selected = allDecks.filter(d => deckIds.includes(d.id));
    if (selected.length === 0) { alert("デッキが見つかりません"); return; }

    const userName = localStorage.getItem("cq_username") || "名無し";
    // 各デッキのカード名を解決
    const deckData = await Promise.all(selected.map(async d => {
      const heroName = await getHeroName(d.heroId);
      const cardNames = await Promise.all((d.cards||[]).map(id => getCardName(id)));
      return { heroId: d.heroId, heroName, cards: d.cards, cardNames, name: d.name };
    }));

    const listId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await setDoc(doc(db, "questionLists", listId), {
      listId,
      listName,
      userName,
      decks: deckData,
      deckCount: deckData.length,
      createdAt: serverTimestamp()
    });
    return listId;
  } catch (e) {
    console.error("[firebase-sync] リスト公開エラー:", e);
    throw e;
  }
};

// 問題リストをIDで取得
window.fbFetchList = async function(listId) {
  try {
    const { getDoc } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js");
    const snap = await getDoc(doc(db, "questionLists", listId));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (e) {
    console.error("[firebase-sync] リスト取得エラー:", e);
    return null;
  }
};

// 最近の公開リスト一覧を取得
window.fbListRecent = async function(maxCount = 20) {
  try {
    const q = query(collection(db, "questionLists"), orderBy("createdAt", "desc"), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error("[firebase-sync] リスト一覧取得エラー:", e);
    return [];
  }
};

// デッキ保存ボタンにフック
document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.querySelector("#s-manage .btn-p");
  if (!saveBtn) return;
  saveBtn.addEventListener("click", async () => {
    setTimeout(async () => {
      try {
        const raw = localStorage.getItem("cq_decks");
        const decks = raw ? JSON.parse(raw) : [];
        const latest = decks[decks.length - 1];
        if (!latest) return;
        await saveDeckToFirebase(latest);
      } catch (e) {
        console.error("[firebase-sync] 保存エラー:", e);
      }
    }, 300);
  });
});
