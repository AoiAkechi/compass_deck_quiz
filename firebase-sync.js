(async () => {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js");

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

  const _originalMgSave = window.mgSave;

  window.mgSave = async function () {
    const hero = window.mgSelectedHero;
    const cards = window.mgCards || [];
    const deckName = document.getElementById("mg-name")?.value?.trim();

    console.log("[firebase-sync] mgSave 呼ばれた");
    console.log("[firebase-sync] hero:", hero);
    console.log("[firebase-sync] cards:", cards);
    console.log("[firebase-sync] deckName:", deckName);

    if (!hero || cards.filter(Boolean).length < 4 || !deckName) {
      console.warn("[firebase-sync] バリデーション失敗のためスキップ");
      _originalMgSave();
      return;
    }

    _originalMgSave();

    try {
      const userName = localStorage.getItem("cq_username") || "名無し";
      const heroData = (window.HEROES || []).find(h => h.id === hero);
      const heroName = heroData?.name || hero;

      const cardList = cards.filter(Boolean).map(c => ({
        id: c.id,
        name: c.name || c.id,
        image: `images/${c.id}.jpg`
      }));

      console.log("[firebase-sync] Firestore送信中...", { userName, heroName, deckName, cardList });

      await addDoc(collection(db, "decks"), {
        userName,
        deckName,
        heroId: hero,
        heroName,
        cards: cardList,
        createdAt: serverTimestamp()
      });

      console.log("[firebase-sync] 保存完了:", heroName, "/", deckName);
    } catch (e) {
      console.error("[firebase-sync] 保存エラー:", e);
    }
  };

  console.log("[firebase-sync] 初期化完了");
})();
