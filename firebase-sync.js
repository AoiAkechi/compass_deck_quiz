// firebase-sync.js
// app.js を触らずに Firestore へデッキを保存する

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

// app.js の mgSave をフックして Firestore にも保存する
document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.querySelector("#s-manage .btn-p");
  if (!saveBtn) return;

  saveBtn.addEventListener("click", async () => {
    // app.js 側の保存が走った後に少し待ってから取得
    setTimeout(async () => {
      try {
        const userName = localStorage.getItem("cq_username") || "名無し";
        const deckName = document.getElementById("mg-name")?.value?.trim() || "名称未設定";

        // app.js が localStorage に保存しているデッキ一覧から最新を取得
        const raw = localStorage.getItem("cq_decks");
        const decks = raw ? JSON.parse(raw) : [];
        const latest = decks[decks.length - 1];
        if (!latest) return;

        await addDoc(collection(db, "decks"), {
          userName,
          deckName: latest.name || deckName,
          hero: latest.hero || null,
          cards: latest.cards || [],
          createdAt: serverTimestamp()
        });

        console.log("[firebase-sync] Firestore に保存しました:", latest.name);
      } catch (e) {
        console.error("[firebase-sync] 保存エラー:", e);
      }
    }, 300);
  });
});
