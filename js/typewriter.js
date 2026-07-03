(function (g) {
  const HALLUC = ["你没事的。", "还没下班吗?", "他们都在看你。", "回工位去。", "疼吗?会习惯的。"];
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function parseMarkup(text) {
    let plain = "";
    const html = String(text).replace(/\{(item|npc|red):([^}]*)\}|([^{]+|\{)/g,
      (m, tag, val, lit) => {
        if (tag) { plain += val; return `<span class="kw-${tag}">${esc(val)}</span>`; }
        plain += lit; return esc(lit);
      });
    return { html, plain };
  }
  function render(el, text, opts) {
    opts = opts || {};
    const { html } = parseMarkup(text);
    const speed = opts.speed == null ? 18 : opts.speed;
    // 拆成"字符或完整span"的序列,保证标签不被截断
    const parts = html.match(/<span[^>]*>.*?<\/span>|&[a-z]+;|[\s\S]/g) || [];
    let i = 0, timer = null, done = false;
    const target = document.createElement("div");
    el.appendChild(target);
    function glitchify(chunk) {
      if (!opts.fx || !opts.sanLow) return chunk;
      if (chunk.length === 1 && /[一-鿿]/.test(chunk) && Math.random() < 0.025)
        return `<span class="glitch">${chunk}</span>`;
      return chunk;
    }
    function finish() {
      if (done) return; done = true;
      if (timer) clearInterval(timer);
      target.innerHTML = parts.join("");
      if (opts.fx && opts.sanLow && Math.random() < 0.15) {
        const h = document.createElement("div");
        h.className = "glitch"; h.textContent = HALLUC[Math.floor(Math.random() * HALLUC.length)];
        target.appendChild(h); setTimeout(() => h.remove(), 600);
      }
      el.removeEventListener("click", finish);
      if (opts.onDone) opts.onDone();
    }
    if (speed === 0) { finish(); return { skip: finish }; }
    el.addEventListener("click", finish);
    timer = setInterval(() => {
      if (i >= parts.length) return finish();
      target.innerHTML += glitchify(parts[i++]);
    }, speed);
    return { skip: finish };
  }
  g.TYPE = { parseMarkup, render };
})(typeof window !== "undefined" ? window : globalThis);
