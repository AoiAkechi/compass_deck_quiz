/* drag.js — ドラッグ＆ドロップ（マウス・タッチ共通） */

let dragCardId   = null;
let dragFromSlot = null; // { prefix, index }

function onPickCardDragStart(e, cardId) {
  dragCardId   = cardId;
  dragFromSlot = null;
  e.dataTransfer.effectAllowed = "copy";
}

function onSlotDragStart(e, prefix, index) {
  const cards = prefix === "ms" ? mgCards : hostCards;
  if (!cards[index]) return;
  dragCardId   = cards[index].id;
  dragFromSlot = { prefix, index };
  e.dataTransfer.effectAllowed = "move";
}

function initSlotDrop(slotEl, onDropFn) {
  slotEl.addEventListener("dragover", e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    slotEl.classList.add("drag-over");
  });
  slotEl.addEventListener("dragleave", () => slotEl.classList.remove("drag-over"));
  slotEl.addEventListener("drop", e => {
    e.preventDefault();
    slotEl.classList.remove("drag-over");
    if (dragCardId) onDropFn(dragCardId);
  });
}

function setupSlotDrops(prefix, slotCount, onDrop) {
  for (let i = 0; i < slotCount; i++) {
    const el = document.getElementById(`${prefix}${i}`);
    if (!el) continue;
    el.setAttribute("draggable", "true");
    el.addEventListener("dragstart", e => {
      if (e.target.closest(".s-del")) return;
      onSlotDragStart(e, prefix, i);
    });
    initSlotDrop(el, cid => {
      if (dragFromSlot && dragFromSlot.prefix === prefix) {
        swapSlots(prefix, dragFromSlot.index, i);
      } else {
        onDrop(i, cid);
      }
      dragFromSlot = null;
    });
  }
}

function swapSlots(prefix, from, to) {
  if (from === to) return;
  const cards    = prefix === "ms" ? mgCards    : hostCards;
  const updateFn = prefix === "ms" ? updateSlotEl : updateHostSlot;
  const resetFn  = prefix === "ms" ? resetSlotEl  : resetHostSlot;
  [cards[from], cards[to]] = [cards[to], cards[from]];
  cards[to]   ? updateFn(to,   cards[to])   : resetFn(to);
  cards[from] ? updateFn(from, cards[from]) : resetFn(from);
}

function isDuplicate(cards, cardId, excludeIdx) {
  return cards.some((c, j) => c && c.id === cardId && j !== excludeIdx);
}

// --- タッチドラッグ ---
let touchDragCard = null, touchDragEl = null, touchClone = null;
let touchStartX = 0, touchStartY = 0, touchDragging = false;
let touchFromSlot = null;
const DRAG_THRESHOLD = 8;

function initTouchDrag() {
  document.addEventListener("touchstart", e => {
    const slot = e.target.closest(".slot[id]");
    if (slot) {
      const { prefix, index } = parseSlotId(slot.id);
      if (prefix) {
        const cards = prefix === "ms" ? mgCards : hostCards;
        if (cards[index]) {
          touchDragCard  = cards[index].id;
          touchDragEl    = slot;
          touchFromSlot  = { prefix, index };
          touchDragging  = false;
          const t = e.touches[0];
          touchStartX = t.clientX; touchStartY = t.clientY;
          return;
        }
      }
    }
    const pc = e.target.closest(".pick-card");
    if (!pc || !pc.dataset.cid) return;
    touchDragCard = pc.dataset.cid;
    touchDragEl   = pc;
    touchFromSlot = null;
    touchDragging = false;
    const t = e.touches[0];
    touchStartX = t.clientX; touchStartY = t.clientY;
  }, { passive: true });

  document.addEventListener("touchmove", e => {
    if (!touchDragCard) return;
    const t  = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    if (!touchDragging) {
      if (Math.sqrt(dx*dx + dy*dy) < DRAG_THRESHOLD) return;
      touchDragging = true;
      const rect = touchDragEl.getBoundingClientRect();
      touchClone = touchDragEl.cloneNode(true);
      Object.assign(touchClone.style, {
        position:"fixed", opacity:"0.85", pointerEvents:"none", zIndex:"9999",
        width:`${rect.width}px`, height:`${rect.height}px`,
        transform:"scale(1.08)", transition:"none",
        left:`${rect.left}px`, top:`${rect.top}px`,
      });
      document.body.appendChild(touchClone);
    }

    e.preventDefault();
    if (!touchClone) return;

    const rect = touchClone.getBoundingClientRect();
    touchClone.style.left = (t.clientX - rect.width  / 2) + "px";
    touchClone.style.top  = (t.clientY - rect.height / 2) + "px";

    document.querySelectorAll(".slot").forEach(s => s.classList.remove("drag-over"));
    touchClone.style.display = "none";
    const below = document.elementFromPoint(t.clientX, t.clientY);
    touchClone.style.display = "";
    below?.closest(".slot")?.classList.add("drag-over");
  }, { passive: false });

  document.addEventListener("touchend", e => {
    document.querySelectorAll(".slot").forEach(s => s.classList.remove("drag-over"));
    if (touchClone) { touchClone.remove(); touchClone = null; }

    if (touchDragging && touchDragCard) {
      const touch = e.changedTouches[0];
      const el    = document.elementFromPoint(touch.clientX, touch.clientY);
      const slot  = el?.closest(".slot[id]");
      if (slot) handleTouchDrop(slot.id);
    }
    touchDragCard = touchDragEl = null;
    touchDragging = false; touchFromSlot = null;
  }, { passive: true });
}

function parseSlotId(id) {
  if (id.startsWith("ms")) return { prefix:"ms", index:parseInt(id.slice(2)) };
  if (id.startsWith("hs")) return { prefix:"hs", index:parseInt(id.slice(2)) };
  return { prefix:null, index:-1 };
}

function handleTouchDrop(slotId) {
  const { prefix, index: to } = parseSlotId(slotId);
  if (!prefix) return;

  if (touchFromSlot && touchFromSlot.prefix === prefix && touchFromSlot.index !== to) {
    swapSlots(prefix, touchFromSlot.index, to);
    return;
  }
  if (touchFromSlot) return; // 異なるプレフィックス間は無視

  const cards    = prefix === "ms" ? mgCards    : hostCards;
  const updateFn = prefix === "ms" ? updateSlotEl : updateHostSlot;
  if (isDuplicate(cards, touchDragCard, to)) {
    alert("同じカードはすでに使用されています");
    return;
  }
  const card = cardInfo(touchDragCard);
  cards[to] = card;
  updateFn(to, card);
}
