// firebase-sync.js
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

document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.querySelector("#s-manage .btn-p");
  if (!saveBtn) { console.warn("[firebase-sync] 保存ボタンが見つかりません"); return; }

  saveBtn.addEventListener("click", async () => {
    // デバッグ用：変数の中身を確認
    console.log("[firebase-sync] hero:", window.mgSelectedHero);
    console.log("[firebase-sync] cards:", window.mgCards);
    console.log("[firebase-sync] HEROES:", window.HEROES?.length);

    const hero = window.mgSelectedHero;
    const cards = window.mgCards || [];
    const deckName = document.getElementById("mg-name")?.value?.trim();

    if (!hero) { console.warn("[firebase-sync] ヒーロー未選択のためスキップ"); return; }
    if (cards.filter(Boolean).length < 4) { console.warn("[firebase-sync] カード4枚未満のためスキップ"); return; }
    if (!deckName) { console.warn("[firebase-sync] デッキ名未入力のためスキップ"); return; }

    try {
      const userName = localStorage.getItem("cq_username") || "名無し";
      const heroData = (window.HEROES || []).find(h => h.id === hero);
      const heroName = heroData?.name || hero;

      const cardList = cards.filter(Boolean).map(c => ({
        id: c.id,
        name: c.name || c.id,
        image: `images/${c.id}.jpg`
      }));

      await addDoc(collection(db, "decks"), {
        userName,
        deckName,
        heroId: hero,
        heroName,
        cards: cardList,
        createdAt: serverTimestamp()
      });

      console.log("[firebase-sync] 保存完了:", deckName, "/", heroName);
    } catch (e) {
      console.error("[firebase-sync] 保存エラー:", e);
    }
  });
});
