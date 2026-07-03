(function (g) {
  const PRE = "mbdt_";
  let store = null;
  function readJSON(k) { const raw = store.getItem(PRE + k); if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; } }
  function writeJSON(k, v) { store.setItem(PRE + k, JSON.stringify(v)); }
  function wrap(state, chapterTitle) {
    return { version: 1, state, chapterTitle: chapterTitle || "", savedAt: Date.now() };
  }
  function toB64(str) { // UTF-8 安全 Base64,浏览器与 Node 通用
    if (typeof Buffer !== "undefined") return Buffer.from(str, "utf8").toString("base64");
    return btoa(unescape(encodeURIComponent(str)));
  }
  function fromB64(b64) {
    if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf8");
    return decodeURIComponent(escape(atob(b64)));
  }
  g.SAVE = {
    init(storageLike) { store = storageLike || (typeof localStorage !== "undefined" ? localStorage : null); },
    auto(state) { writeJSON("save_auto", wrap(state)); },
    loadAuto() { const w = readJSON("save_auto"); return w ? w.state : null; },
    save(slot, state, chapterTitle) { writeJSON("save_" + slot, wrap(state, chapterTitle)); },
    load(slot) { const w = readJSON("save_" + slot); return w ? w.state : null; },
    del(slot) { store.removeItem(PRE + "save_" + slot); },
    list() {
      const out = [];
      for (let i = 1; i <= 5; i++) {
        const w = readJSON("save_" + i);
        out.push(w ? { slot: i, empty: false, chapterTitle: w.chapterTitle,
          day: w.state.day, hp: w.state.hp, san: w.state.san, savedAt: w.savedAt }
          : { slot: i, empty: true });
      }
      return out;
    },
    exportCode(state) { return toB64(JSON.stringify(wrap(state))); },
    importCode(code) {
      let w; try { w = JSON.parse(fromB64(String(code).trim())); } catch (e) { throw new Error("存档码无法解析"); }
      if (!w || w.version !== 1 || !w.state || typeof w.state.hp !== "number") throw new Error("存档码内容非法");
      return w.state;
    },
    unlockEnding(eid) { const l = readJSON("endings") || [];
      if (!l.includes(eid)) { l.push(eid); writeJSON("endings", l); } },
    unlockedEndings() { return readJSON("endings") || []; },
    markChapter(cid) { const l = readJSON("chapters") || [];
      if (!l.includes(cid)) { l.push(cid); writeJSON("chapters", l); } },
    reachedChapters() { return readJSON("chapters") || []; }
  };
  if (typeof localStorage !== "undefined") g.SAVE.init(localStorage);
})(typeof window !== "undefined" ? window : globalThis);
