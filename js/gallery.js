/* 结局图鉴:28格收集墙 */
(function (g) {
  const ORDER = [];
  for (let i = 1; i <= 18; i++) ORDER.push("E" + String(i).padStart(2, "0"));
  for (let i = 1; i <= 10; i++) ORDER.push("D" + String(i).padStart(2, "0"));

  function endingNodeId(eid) { return eid[0] === "E" ? "end_" + eid : "die_" + eid; }

  g.GALLERY = {
    open() {
      const doc = document;
      const grid = doc.getElementById("gallery-grid");
      const detail = doc.getElementById("gallery-detail");
      const unlocked = g.SAVE.unlockedEndings();
      grid.innerHTML = ""; detail.hidden = true; detail.innerHTML = "";
      doc.getElementById("gallery-count").textContent =
        "已解锁 " + unlocked.filter(e => ORDER.includes(e)).length + " / " + ORDER.length;
      for (const eid of ORDER) {
        const meta = g.STORY.endings[eid] || { name: "???", hint: "", type: "death" };
        const cell = doc.createElement("div");
        const isOpen = unlocked.includes(eid);
        cell.className = "g-cell " + (isOpen ? "unlocked " + meta.type : "locked-cell");
        cell.innerHTML = isOpen
          ? `<span class="g-id">${eid}</span><span>${meta.name}</span>`
          : `<span class="g-id">${eid}</span><span>???</span><span class="g-hint">${meta.hint}</span>`;
        cell.onclick = () => {
          if (!isOpen) { detail.hidden = false; detail.textContent = "「" + meta.hint + "」\n\n(尚未解锁)"; return; }
          const node = g.STORY.nodes[endingNodeId(eid)];
          detail.hidden = false;
          detail.innerHTML = `<p class="ending-title">结局 ${eid} · ${meta.name}</p>` +
            (node ? g.TYPE.parseMarkup(node.text).html : "(本结局将在后续版本开放)");
        };
        grid.appendChild(cell);
      }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
