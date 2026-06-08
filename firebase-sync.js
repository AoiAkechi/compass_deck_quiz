// firebase-sync.js — 通常scriptとして読み込む（type="module"不要）

(async () => {
  // Firebase を動的インポート
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

  // app.js の mgSave をラップ（元の処理を実行してから Firestore に送信）
  const _originalMgSave = window.mgSave;

  window.mgSave = async function () {
    // バリデーション（app.js と同じ条件）
    const hero = window.mgSelectedHero;
    const cards = window.mgCards || [];
    const deckName = document.getElementById("mg-name")?.value?.trim();

    // 条件を満たさない場合は元の処理だけ実行（alertを出すため）
    if (!hero || cards.filter(Boolean).length < 4 || !deckName) {
      _originalMgSave();
      return;
    }

    // 元の保存処理を実行
    _originalMgSave();

    // Firestore に送信
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

      console.log("[firebase-sync] 保存完了:", heroName, "/", deckName);
    } catch (e) {
      console.error("[firebase-sync] 保存エラー:", e);
    }
  };

  console.log("[firebase-sync] 初期化完了");
})();
