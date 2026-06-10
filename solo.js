/* solo.js — ソロ練習モード */

let soloScore = 0, soloIdx = 0, soloOrder = [], soloAnswered = false, soloTI = null;
let soloCorrectId = null;

function startSolo(deckList) {
  const pool = deckList || decks;
  if (pool.length === 0) { go("s-manage"); return; }
  soloScore = 0; soloIdx = 0;
  soloOrder = [...pool].sort(() => Math.random() - .5).slice(0, Math.min(10, pool.length));
  document.getElementById("qtot").textContent = soloOrder.length;
  showQ();
  go("s-quiz");
}

function showQ() {
  clearInterval(soloTI);
  soloAnswered = false;
  const deck = soloOrder[soloIdx];
  soloCorrectId = deck.heroId;
  document.getElementById("qnum").textContent    = soloIdx + 1;
  document.getElementById("sscore").textContent  = soloScore;
  document.getElementById("sq-flash").innerHTML  = "";
  document.getElementById("sq-next").style.display = "none";
  renderCards("sq-cards", deck.cards);

  renderHeroPicker("sq-hero-picker", hid => {
    if (soloAnswered) return;
    soloAnswered = true;
    clearInterval(soloTI);
    const name = heroName(soloCorrectId);
    if (hid === soloCorrectId) {
      soloScore++;
      document.getElementById("sscore").textContent = soloScore;
      document.getElementById("sq-flash").innerHTML = `<div class="flash ok">正解　${name}</div>`;
      updateHeroList("sq-hero-picker", "", () => {}, { disabled:true, correctId:soloCorrectId });
    } else {
      document.getElementById("sq-flash").innerHTML = `<div class="flash ng">不正解　正解は「${name}」</div>`;
      updateHeroList("sq-hero-picker", "", () => {}, { disabled:true, correctId:soloCorrectId, wrongId:hid });
    }
    document.getElementById("sq-hero-picker-input").disabled = true;
    document.getElementById("sq-next").style.display = "block";
  }, {});

  let t = 15;
  document.getElementById("s-timer").style.width = "100%";
  soloTI = setInterval(() => {
    t -= 0.1;
    document.getElementById("s-timer").style.width = Math.max(0, t / 15 * 100) + "%";
    if (t <= 0) {
      clearInterval(soloTI);
      if (!soloAnswered) {
        soloAnswered = true;
        document.getElementById("sq-flash").innerHTML =
          `<div class="flash ng">時間切れ　正解は「${heroName(soloCorrectId)}」</div>`;
        updateHeroList("sq-hero-picker", "", () => {}, { disabled:true, revealId:soloCorrectId });
        document.getElementById("sq-hero-picker-input").disabled = true;
        document.getElementById("sq-next").style.display = "block";
      }
    }
  }, 100);
}

function soloNext() {
  soloIdx++;
  if (soloIdx >= soloOrder.length) {
    clearInterval(soloTI);
    const pct = Math.round(soloScore / soloOrder.length * 100);
    document.getElementById("res-score").textContent = `${soloScore} / ${soloOrder.length}`;
    document.getElementById("res-sub").textContent   = `正答率 ${pct}%`;
    const title =
      pct >= 80 ? "全問正解まであと少し" :
      pct >= 40 ? "半分以上正解" : "もう一度挑戦してみよう";
    document.getElementById("res-emoji").textContent = "";
    document.getElementById("res-title").textContent = title;
    go("s-result");
    return;
  }
  showQ();
}
