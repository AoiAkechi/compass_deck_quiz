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
  if (!saveBtn) return;

  saveBtn.addEventListener("click", async () => {
    // app.js と同じバリデーション — 条件を満たさない場合は送信しない
    const hero = window.mgSelectedHero;
    const cards = window.mgCards || [];
    const deckName = document.getElementById("mg-name")?.value?.trim();

    if (!hero) return;
    if (cards.filter(Boolean).length < 4) return;
    if (!deckName) return;

    try {
      const userName = localStorage.getItem("cq_username") || "名無し";

      // ヒーロー名を HEROES 配列から取得
      const heroData = (window.HEROES || []).find(h => h.id === hero);
      const heroName = heroData?.name || hero;

      // カード情報（id + 画像パス）
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
