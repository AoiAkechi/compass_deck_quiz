// firebase-sync.js
// app.js を一切変更せず Firestore へデッキを保存する

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

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

// heroes.json を読み込んで heroId → heroName に変換する
let heroesCache = null;
async function getHeroName(heroId) {
  if (!heroesCache) {
    try {
      const res = await fetch("heroes.json");
      heroesCache = await res.json();
    } catch (e) {
      console.warn("[firebase-sync] heroes.json の読み込み失敗:", e);
      heroesCache = [];
    }
  }
  const hero = heroesCache.find(h => h.id === heroId);
  return hero ? hero.name : heroId;
}

// app.js の mgSave ボタンにフックして Firestore に保存
document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.querySelector("#s-manage .btn-p");
  if (!saveBtn) {
    console.warn("[firebase-sync] 保存ボタンが見つかりませんでした");
    return;
  }

  saveBtn.addEventListener("click", async () => {
    // app.js 側の localStorage 書き込みを待つ
    setTimeout(async () => {
      try {
        const userName = localStorage.getItem("cq_username") || "名無し";

        const raw = localStorage.getItem("cq_decks");
        const decks = raw ? JSON.parse(raw) : [];
        const latest = decks[decks.length - 1];
        if (!latest) return;

        const heroName = await getHeroName(latest.heroId);

        await addDoc(collection(db, "decks"), {
          userName,
          deckName: latest.name || "名称未設定",
          heroId:   latest.heroId  || null,
          heroName,
          cards:    latest.cards   || [],
          createdAt: serverTimestamp()
        });

        console.log("[firebase-sync] 保存完了:", latest.name, "/", heroName);
      } catch (e) {
        console.error("[firebase-sync] 保存エラー:", e);
      }
    }, 300);
  });
});
