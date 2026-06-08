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
    // バリデーション — DOM から直接読み取る（let変数はwindowに出ないため）
    const heroInput = document.getElementById("mg-hero-picker-input");
    const heroItem = document.querySelector("#mg-hero-picker-list .hero-list-item.selected");
    const heroId = heroItem?.dataset?.hid || null;
    const heroName = heroInput?.value?.trim() || null;

    const deckName = document.getElementById("mg-name")?.value?.trim();

    // スロットに入っているカードIDをDOMから取得
    const cardIds = [0,1,2,3].map(i => {
      const slot = document.getElementById(`ms${i}`);
      if (!slot?.classList.contains("has")) return null;
      // ct-overlay内のct-idテキストではなくdata属性から取る
      const ctImg = slot.querySelector(".ct-img");
      if (ctImg) {
        const src = ctImg.getAttribute("src") || "";
        const match = src.match(/images\/(.+)\.jpg/);
        return match ? match[1] : null;
      }
      return null;
    });

    const validCards = cardIds.filter(Boolean);

    // バリデーション失敗なら元の処理（alert）だけ実行
    if (!heroId || validCards.length < 4 || !deckName) {
      _originalMgSave();
      return;
    }

    // 元の保存処理を実行
    _originalMgSave();

    // Firestore に送信
    try {
      const userName = localStorage.getItem("cq_username") || "名無し";

      const cardList = validCards.map(id => ({
        id,
        image: `images/${id}.jpg`
      }));

      await addDoc(collection(db, "decks"), {
        userName,
        deckName,
        heroId,
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
