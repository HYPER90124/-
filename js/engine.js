/* 《末班地铁》引擎:节点渲染与游戏流程(仅浏览器环境) */
(function () {
  const $ = id => document.getElementById(id);
  const CORE = window.CORE, SAVE = window.SAVE, TYPE = window.TYPE, STORY = window.STORY;

  const NOTE_LABELS = { hp: "体魄", san: "理智", battery: "电量", batteries: "备用电池" };

  const ENGINE = {
    state: null,
    settings: { speed: 18, fx: true },

    /* ---------- 启动 ---------- */
    boot() {
      const raw = localStorage.getItem("mbdt_settings");
      if (raw) { try { Object.assign(this.settings, JSON.parse(raw)); } catch (e) {} }
      this.loadScripts(window.STORY_FILES.slice(), () => this.bindUI());
    },
    loadScripts(files, onDone) {
      if (files.length === 0) return onDone();
      const s = document.createElement("script");
      s.src = files.shift();
      s.onload = () => this.loadScripts(files, onDone);
      s.onerror = () => { alert("剧情文件加载失败: " + s.src); };
      document.body.appendChild(s);
    },

    /* ---------- 界面切换 ---------- */
    show(screenId) {
      document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
      $(screenId).classList.add("active");
      window.scrollTo(0, 0);
    },
    confirm(text, onOk) {
      $("modal-text").textContent = text;
      $("modal").hidden = false;
      $("modal-ok").onclick = () => { $("modal").hidden = true; onOk(); };
      $("modal-cancel").onclick = () => { $("modal").hidden = true; };
    },
    toast(text) { // 单按钮提示复用 modal
      $("modal-text").textContent = text;
      $("modal").hidden = false;
      $("modal-cancel").style.display = "none";
      $("modal-ok").onclick = () => { $("modal").hidden = true; $("modal-cancel").style.display = ""; };
    },

    bindUI() {
      $("btn-new").onclick = () => {
        if (SAVE.loadAuto()) this.confirm("开始新游戏会覆盖自动存档,确定?", () => this.newGame());
        else this.newGame();
      };
      $("btn-continue").onclick = () => this.continueGame();
      $("btn-saves").onclick = () => { this.renderSaves(); this.show("screen-saves"); };
      $("btn-gallery").onclick = () => { window.GALLERY.open(); this.show("screen-gallery"); };
      $("btn-settings").onclick = () => { this.renderSettings(); this.show("screen-settings"); };
      $("btn-game-menu").onclick = () =>
        this.confirm("回到标题?(进度已自动保存)", () => this.toTitle());
      $("st-items").onclick = () => this.openBag();
      $("bag-close").onclick = () => { $("bag").hidden = true; };
      document.querySelectorAll("[data-back]").forEach(b => b.onclick = () => this.toTitle());
      $("btn-export").onclick = () => {
        const st = this.state || SAVE.loadAuto();
        if (!st) return this.toast("还没有可导出的进度。");
        $("save-io-text").value = SAVE.exportCode(st);
        this.toast("存档码已生成,请全选复制保存。");
      };
      $("btn-import").onclick = () => {
        try {
          const st = SAVE.importCode($("save-io-text").value);
          this.state = st; SAVE.auto(st);
          this.show("screen-game"); this.render(st.node, { skipEffects: true });
        } catch (e) { this.toast(e.message); }
      };
      $("btn-chapter-go").onclick = () => {
        const cid = $("set-chapter").value;
        if (!cid || !STORY.chapters[cid]) return;
        this.confirm("从「" + STORY.chapters[cid].title + "」重新开始?(当前自动档将被覆盖)", () => {
          this.state = CORE.newState();
          this.state.node = STORY.chapters[cid].start;
          if (!this.state.chaptersReached.includes(cid)) this.state.chaptersReached.push(cid);
          this.show("screen-game"); this.goto(STORY.chapters[cid].start, true);
        });
      };
      $("set-speed").onchange = e => { this.settings.speed = Number(e.target.value); this.saveSettings(); };
      $("set-fx").onchange = e => { this.settings.fx = e.target.checked; this.saveSettings(); };
      this.refreshTitle();
    },
    saveSettings() { localStorage.setItem("mbdt_settings", JSON.stringify(this.settings)); },
    refreshTitle() { $("btn-continue").disabled = !SAVE.loadAuto(); },
    toTitle() { this.refreshTitle(); this.show("screen-title"); },

    /* ---------- 游戏流程 ---------- */
    newGame() {
      this.state = CORE.newState();
      this.show("screen-game");
      this.goto(this.state.node, true);
    },
    continueGame() {
      const st = SAVE.loadAuto();
      if (!st) return;
      this.state = st;
      this.show("screen-game");
      this.render(st.node, { skipEffects: true });
    },

    /* goto: 正常前进(结算 effects → 判死 → 自动存档 → 渲染) */
    goto(id, isEntry) {
      const node = STORY.nodes[id];
      if (!node) { alert("节点缺失: " + id); return; }
      const st = this.state;
      const changes = CORE.applyEffects(node.effects, st);
      st.node = id;
      st.visited.push(id);
      const cid = STORY.nodeChapter[id];
      if (cid && STORY.chapters[cid]) {
        SAVE.markChapter(cid);
        if (!st.chaptersReached.includes(cid)) st.chaptersReached.push(cid);
      }
      // 判死(结局节点与die_hp自身不再跳转,防递归)
      if (!node.ending && id !== "die_hp") {
        if (st.hp <= 0) { this.floatNotes(changes); return this.goto("die_hp"); }
        if (st.san <= 0) { this.floatNotes(changes); return this.goto("die_D10"); }
      }
      SAVE.auto(st);
      this.render(id, { changes });
    },

    /* render: 纯渲染(读档/导入恢复走 skipEffects 路径) */
    render(id, opts) {
      opts = opts || {};
      const node = STORY.nodes[id];
      const st = this.state;
      document.body.classList.toggle("san-low", st.san < 30);
      document.body.classList.remove("gold-focus", "dying");
      this.updateStatusbar();
      if (opts.changes) this.floatNotes(opts.changes);
      const nar = $("narrative"), cho = $("choices");
      nar.innerHTML = ""; cho.innerHTML = "";
      TYPE.render(nar, node.text, {
        speed: this.settings.speed, fx: this.settings.fx,
        sanLow: st.san < 30, clickTarget: $("screen-game"),
        onDone: () => this.renderChoices(node)
      });
    },

    renderChoices(node) {
      const st = this.state, cho = $("choices");
      cho.innerHTML = "";
      // 结局节点
      if (node.ending) {
        SAVE.unlockEnding(node.ending);
        const meta = STORY.endings[node.ending] || { name: "", type: "death" };
        if (node.ending[0] === "D") document.body.classList.add("dying");
        const h = document.createElement("p");
        h.className = "ending-title";
        h.textContent = "— 结局 " + node.ending + " · " + meta.name + " —";
        cho.appendChild(h);
        this.addBtn(cho, "回到标题", () => this.toTitle());
        this.addBtn(cho, "结局图鉴", () => { window.GALLERY.open(); this.show("screen-gallery"); });
        return;
      }
      // 死亡兜底(die_hp 无 ending 字段)
      if (node === STORY.nodes["die_hp"]) {
        document.body.classList.add("dying");
        this.addBtn(cho, "回到标题", () => this.toTitle());
        return;
      }
      // 内容尽头封锁
      if (node.endOfContent) {
        const d = document.createElement("div");
        d.className = "end-of-content";
        d.textContent = node.endOfContent === true
          ? "—— 前方的路被军方路障封死了,故事将在下个版本继续 ——" : node.endOfContent;
        cho.appendChild(d);
        this.addBtn(cho, "回到标题", () => this.toTitle());
        return;
      }
      // 无选项直连
      if (!node.choices || node.choices.length === 0) {
        this.addBtn(cho, "▼ 继续", () => this.goto(node.goto));
        return;
      }
      // gold 聚焦
      if (node.choices.some(c => c.color === "gold")) {
        document.body.classList.add("gold-focus");
        const tip = document.createElement("p");
        tip.className = "gold-tip";
        tip.textContent = "—— 此选择将改变你的命运 ——";
        cho.appendChild(tip);
      }
      for (const c of node.choices) {
        const chk = CORE.checkRequire(c.require, st);
        if (!chk.ok && c.hideWhenLocked) continue;
        const b = document.createElement("button");
        b.className = "choice " + (c.color || "white") + (chk.ok ? "" : " locked");
        b.innerHTML = TYPE.parseMarkup(c.text).html;
        if (!chk.ok) {
          b.disabled = true;
          const r = document.createElement("span");
          r.className = "lock-reason";
          r.textContent = "🔒 " + chk.missing.join(" · ");
          b.appendChild(r);
        } else {
          b.onclick = () => {
            document.body.classList.remove("gold-focus");
            const changes = CORE.applyEffects(c.effects, st);
            this.floatNotes(changes);
            this.goto(c.goto);
          };
        }
        cho.appendChild(b);
      }
    },

    addBtn(parent, text, onclick) {
      const b = document.createElement("button");
      b.className = "menu-btn"; b.textContent = text; b.onclick = onclick;
      parent.appendChild(b);
    },

    /* ---------- 状态栏与飘字 ---------- */
    updateStatusbar() {
      const st = this.state;
      $("st-day").textContent = "Day " + st.day;
      $("st-hp").textContent = "❤️" + st.hp;
      $("st-san").textContent = "🧠" + st.san;
      $("st-items").textContent = "🎒" + st.items.length;
      $("st-items").title = st.items.map(CORE.itemName).join("、") || "空";
      const bt = $("st-batt");
      if (st.items.includes("flashlight")) {
        bt.hidden = false; bt.textContent = "🔦" + (st.battery || 0) + "%";
        bt.classList.toggle("low", (st.battery || 0) <= 20);
      } else bt.hidden = true;
    },

    /* ---------- 背包 ---------- */
    openBag() {
      const st = this.state, body = $("bag-body");
      body.innerHTML = "";
      if (!st.items.length && !st.batteries) {
        const p = document.createElement("p");
        p.className = "bag-empty"; p.textContent = "背包空空如也。";
        body.appendChild(p);
      }
      for (const id of st.items) {
        const row = document.createElement("div");
        row.className = "bag-item";
        if (id === "flashlight") {
          const pct = st.battery || 0;
          row.innerHTML = '<span class="bag-name">🔦 ' + CORE.itemName(id) + "</span>"
            + '<span class="bag-batt"><span class="batt-bar"><i style="width:'
            + pct + '%"></i></span>' + pct + "%</span>";
        } else {
          row.innerHTML = '<span class="bag-name">' + CORE.itemName(id) + "</span>";
        }
        body.appendChild(row);
      }
      if (st.batteries > 0) {
        const row = document.createElement("div");
        row.className = "bag-item";
        row.innerHTML = '<span class="bag-name">🔋 备用电池 ×' + st.batteries + "</span>";
        if (st.items.includes("flashlight") && (st.battery || 0) < 100) {
          const btn = document.createElement("button");
          btn.className = "bag-use"; btn.textContent = "装入 (+40%)";
          btn.onclick = () => {
            st.batteries -= 1;
            st.battery = CORE.clamp((st.battery || 0) + 40, 0, 100);
            SAVE.auto(st); this.updateStatusbar(); this.openBag();
          };
          row.appendChild(btn);
        }
        body.appendChild(row);
      }
      $("bag").hidden = false;
    },
    floatNotes(changes) {
      for (const c of changes || []) {
        let label;
        if (NOTE_LABELS[c.k]) label = NOTE_LABELS[c.k];
        else if (c.k.indexOf("aff_") === 0) label = CORE.npcName(c.k.slice(4)) + "·好感";
        else continue; // humanity 等隐藏值不显示
        const el = document.createElement("div");
        el.className = "float-note " + (c.delta < 0 ? "neg" : "pos");
        el.textContent = label + (c.delta > 0 ? " +" : " ") + c.delta;
        $("float-layer").appendChild(el);
        setTimeout(() => el.remove(), 3700);
      }
      this.updateStatusbar();
    }
  };

  window.ENGINE = ENGINE;
  window.addEventListener("DOMContentLoaded", () => ENGINE.boot());
})();
