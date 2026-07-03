# 《末班地铁》P1:引擎 + 序章 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可在手机浏览器游玩的游戏骨架:完整引擎(数值/条件/6色选项/动效/自动+5槽存档/28格结局图鉴)+ 序章「写字楼」完整剧情(含 D01/D02 两个死亡结局)。

**Architecture:** 纯静态站点。`js/core.js` 为环境无关的纯逻辑(状态/条件/效果),Node 可测;`js/engine.js` 负责 DOM 渲染与流程;剧情是挂在全局 `STORY` 注册表上的节点数据文件。`tools/validate.js` 用 Node 遍历全部节点做静态校验+字数统计。

**Tech Stack:** 原生 HTML/CSS/JS(零依赖、零构建);Node ≥16 仅用于本地测试与校验脚本(游戏运行不需要)。

## Global Constraints(源自设计文档,全任务生效)

- 手机竖屏优先:正文字号≥17px,选项按钮全宽、点击区≥44px;默认深色主题;`prefers-reduced-motion` 时禁用动效。
- 选项颜色 class 固定为:`white red green blue purple gold`,锁定态 `locked`。
- 数值键名固定:`hp`(0~100,初始60)、`san`(0~100,初始70)、`humanity`(-100~+100,初始0,不可见)、`aff.{akai,cheng,zhou,xule,xiaoman,qin}`(0~10)、`items`、`flags`、`day`。
- `require` 支持键:`hpAbove hpBelow sanAbove sanBelow humanityAbove humanityBelow item noItem flag noFlag aff:{npc,gte}`(Above/Below 为严格大于/小于)。
- 存档:自动存档 + **5** 个手动槽 + Base64 导出/导入;localStorage 键前缀 `mbdt_`。
- 结局共28个(E01~E18、D01~D10),图鉴只登记带 `ending` 字段的节点;未解锁显示剪影+模糊提示语。
- 节点ID规范:`ch0_/ch1_/h2_/r2_/n2_/s2_/t2_/f2_/c3_` + 三位序号;死亡结局 `die_D01`…;大结局 `end_E01`…。
- 写作规范:第二人称"你";单节点100~300字,重场面≤500字;gold抉择每章≤2个;每个选择3节点内产生可感知差异。
- 病毒名:「鸿茅药酒」(HM-7),受试者编号 HM-041。
- 提交信息用中文,结尾带 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

### Task 1: core.js 纯逻辑层(状态/条件/效果)

**Files:**
- Create: `js/core.js`
- Test: `tools/test-core.js`

**Interfaces:**
- Produces(挂到 `globalThis.CORE`):
  - `CORE.newState() → state`(结构见下)
  - `CORE.checkRequire(req|undefined, state) → {ok:boolean, missing:string[]}`(missing 为人话描述,如 `"需要:消防斧"`)
  - `CORE.applyEffects(effects|undefined, state) → {k:string, delta:number}[]`(仅数值变化,供飘字)

- [ ] **Step 1: 写失败测试 `tools/test-core.js`**

```js
// 运行: node tools/test-core.js
require("../js/core.js");
const C = globalThis.CORE;
let n = 0, f = 0;
function eq(a, b, msg) { n++; const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) { f++; console.error("FAIL", msg, ja, "!=", jb); } }

// newState
const s = C.newState();
eq(s.hp, 60, "hp初始"); eq(s.san, 70, "san初始"); eq(s.humanity, 0, "humanity初始");
eq(s.aff.akai, 0, "aff初始"); eq(s.items, [], "items"); eq(s.flags, [], "flags");
eq(s.day, 0, "day"); eq(typeof s.node, "string", "node");

// checkRequire
eq(C.checkRequire(undefined, s).ok, true, "无条件恒真");
eq(C.checkRequire({ item: "fireAxe" }, s).ok, false, "缺物品");
s.items.push("fireAxe");
eq(C.checkRequire({ item: "fireAxe" }, s).ok, true, "有物品");
eq(C.checkRequire({ noItem: "fireAxe" }, s).ok, false, "noItem");
eq(C.checkRequire({ sanBelow: 70 }, s).ok, false, "sanBelow严格小于");
s.san = 29;
eq(C.checkRequire({ sanBelow: 30 }, s).ok, true, "低理智解锁");
eq(C.checkRequire({ hpAbove: 60 }, s).ok, false, "hpAbove严格大于");
s.flags.push("clue_lab");
eq(C.checkRequire({ flag: "clue_lab", noFlag: "x" }, s).ok, true, "flag组合");
eq(C.checkRequire({ aff: { npc: "zhou", gte: 3 } }, s).ok, false, "好感不足");
s.aff.zhou = 3;
eq(C.checkRequire({ aff: { npc: "zhou", gte: 3 } }, s).ok, true, "好感达标");
eq(C.checkRequire({ item: "carKey" }, s).missing, ["需要:carKey"], "missing描述");

// applyEffects
const s2 = C.newState();
const ch = C.applyEffects({ san: -5, hp: 10, humanity: -10, item: "+fireAxe", flag: "clue_lab", aff_akai: 2, day: 1 }, s2);
eq(s2.san, 65, "san结算"); eq(s2.hp, 70, "hp结算"); eq(s2.humanity, -10, "humanity");
eq(s2.items, ["fireAxe"], "加物品"); eq(s2.flags, ["clue_lab"], "加flag");
eq(s2.aff.akai, 2, "好感"); eq(s2.day, 1, "day绝对值");
eq(ch.some(c => c.k === "san" && c.delta === -5), true, "变化记录");
C.applyEffects({ item: "-fireAxe", hp: 999 }, s2);
eq(s2.items, [], "减物品"); eq(s2.hp, 100, "hp上限clamp");
C.applyEffects({ san: -999 }, s2);
eq(s2.san, 0, "san下限clamp");
C.applyEffects({ aff_akai: 99 }, s2);
eq(s2.aff.akai, 10, "aff上限10");
C.applyEffects({ flag: "clue_lab" }, s2); C.applyEffects({ flag: "clue_lab" }, s2);
eq(s2.flags.filter(x => x === "clue_lab").length <= 1, true, "flag去重");

console.log(f ? `${f}/${n} FAILED` : `ALL ${n} PASS`);
process.exit(f ? 1 : 0);
```

- [ ] **Step 2: 运行确认失败**

Run: `node tools/test-core.js`
Expected: 报错(core.js 不存在)。

- [ ] **Step 3: 实现 `js/core.js`**

```js
/* 《末班地铁》纯逻辑层:环境无关,浏览器与 Node 通用 */
(function (g) {
  const AFF_NPCS = ["akai", "cheng", "zhou", "xule", "xiaoman", "qin"];
  const ITEM_NAMES = { fireAxe: "消防斧", keycard: "员工门禁卡", kunlunCard: "昆仑门禁卡",
    antibiotics: "抗生素", carKey: "车钥匙", note_cheng: "程霜的字条", radio: "收音机" };
  const NPC_NAMES = { akai: "阿凯", cheng: "程霜", zhou: "老周", xule: "许乐", xiaoman: "小满", qin: "秦鹭" };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function newState() {
    return { node: "ch0_001", hp: 60, san: 70, humanity: 0,
      aff: { akai: 0, cheng: 0, zhou: 0, xule: 0, xiaoman: 0, qin: 0 },
      items: [], flags: [], day: 0, visited: [], chaptersReached: ["ch0"] };
  }

  function itemName(id) { return ITEM_NAMES[id] || id; }
  function npcName(id) { return NPC_NAMES[id] || id; }

  function checkRequire(req, state) {
    const missing = [];
    if (!req) return { ok: true, missing };
    if (req.item && !state.items.includes(req.item)) missing.push("需要:" + itemName(req.item));
    if (req.noItem && state.items.includes(req.noItem)) missing.push("不能持有:" + itemName(req.noItem));
    if (req.flag && !state.flags.includes(req.flag)) missing.push("缺少前置事件");
    if (req.noFlag && state.flags.includes(req.noFlag)) missing.push("已错过时机");
    if (req.hpAbove !== undefined && !(state.hp > req.hpAbove)) missing.push("体魄不足");
    if (req.hpBelow !== undefined && !(state.hp < req.hpBelow)) missing.push("体魄过高");
    if (req.sanAbove !== undefined && !(state.san > req.sanAbove)) missing.push("理智不足");
    if (req.sanBelow !== undefined && !(state.san < req.sanBelow)) missing.push("理智过高");
    if (req.humanityAbove !== undefined && !(state.humanity > req.humanityAbove)) missing.push("人性不足");
    if (req.humanityBelow !== undefined && !(state.humanity < req.humanityBelow)) missing.push("人性过高");
    if (req.aff && !((state.aff[req.aff.npc] || 0) >= req.aff.gte))
      missing.push(npcName(req.aff.npc) + "好感不足");
    return { ok: missing.length === 0, missing };
  }

  function applyEffects(effects, state) {
    const changes = [];
    if (!effects) return changes;
    for (const key of Object.keys(effects)) {
      const v = effects[key];
      if (key === "hp" || key === "san") {
        if (v) { state[key] = clamp(state[key] + v, 0, 100); changes.push({ k: key, delta: v }); }
      } else if (key === "humanity") {
        if (v) { state.humanity = clamp(state.humanity + v, -100, 100); changes.push({ k: key, delta: v }); }
      } else if (key === "day") { state.day = v;
      } else if (key === "item") {
        const list = Array.isArray(v) ? v : [v];
        for (const it of list) {
          if (it[0] === "-") { const i = state.items.indexOf(it.slice(1)); if (i >= 0) state.items.splice(i, 1); }
          else { const id = it[0] === "+" ? it.slice(1) : it; if (!state.items.includes(id)) state.items.push(id); }
        }
      } else if (key === "flag") {
        const list = Array.isArray(v) ? v : [v];
        for (const fl of list) if (!state.flags.includes(fl)) state.flags.push(fl);
      } else if (key.indexOf("aff_") === 0) {
        const npc = key.slice(4);
        if (AFF_NPCS.includes(npc) && v) {
          state.aff[npc] = clamp((state.aff[npc] || 0) + v, 0, 10);
          changes.push({ k: key, delta: v });
        }
      }
    }
    return changes;
  }

  g.CORE = { newState, checkRequire, applyEffects, clamp, itemName, npcName, AFF_NPCS };
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node tools/test-core.js`
Expected: `ALL 25 PASS`(数字以实际断言数为准,0 FAILED)。

- [ ] **Step 5: Commit**

```bash
git add js/core.js tools/test-core.js
git commit -m "P1: core纯逻辑层(状态/条件/效果)及测试"
```

---

### Task 2: STORY 注册表 + 静态校验器(含字数统计)

**Files:**
- Create: `js/story-registry.js`(浏览器与 Node 通用)
- Create: `js/story-index.js`(声明要加载的剧情文件清单)
- Create: `tools/validate.js`
- Test: `tools/test-validate.js` + fixture `tools/fixtures/bad-story.js`

**Interfaces:**
- Produces(挂到 `globalThis.STORY`):
  - `STORY.register(chapterId, nodesObj)`(节点并入 `STORY.nodes`,记录 `STORY.nodeChapter[nodeId]=chapterId`)
  - `STORY.registerChapter(chapterId, {title, start})` → 存入 `STORY.chapters`
  - `STORY.registerEndings(metaObj)` → `STORY.endings`,形如 `{E01:{name:"围城之火",hint:"…",type:"fate"|"death"}}`
  - `STORY.nodes` 全节点表
- `js/story-index.js` Produces:`window.STORY_FILES = ["story/ch0-prologue.js", "story/endings.js"]`(后续章节在此追加)
- `tools/validate.js` Produces(供人和CI用):校验 5 项 —— ①goto 悬空 ②require 非法键 ③`ending` 值必须存在于 `STORY.endings` ④节点ID前缀合法 ⑤选项 color 合法;并输出中日韩字符总数(字数统计)。exit 0/1。

- [ ] **Step 1: 写 `js/story-registry.js`**

```js
(function (g) {
  g.STORY = {
    nodes: {}, nodeChapter: {}, chapters: {}, endings: {},
    register(chapterId, nodesObj) {
      for (const id of Object.keys(nodesObj)) {
        if (this.nodes[id]) throw new Error("节点ID重复: " + id);
        this.nodes[id] = nodesObj[id];
        this.nodeChapter[id] = chapterId;
      }
    },
    registerChapter(chapterId, meta) { this.chapters[chapterId] = meta; },
    registerEndings(metaObj) { Object.assign(this.endings, metaObj); }
  };
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 2: 写 `js/story-index.js`**

```js
/* 剧情文件清单:新章节文件必须在此登记(engine 按序注入 <script>) */
(typeof window !== "undefined" ? window : globalThis).STORY_FILES = [
  "story/endings.js",
  "story/ch0-prologue.js"
];
```

- [ ] **Step 3: 写失败测试 `tools/test-validate.js`**

```js
// 运行: node tools/test-validate.js
const { execSync } = require("child_process");
let out = "", code = 0;
try { out = execSync("node tools/validate.js tools/fixtures/bad-story.js", { encoding: "utf8" }); }
catch (e) { code = e.status; out = (e.stdout || "") + (e.stderr || ""); }
let n = 0, f = 0;
function has(sub, msg) { n++; if (!out.includes(sub)) { f++; console.error("FAIL", msg, "\n---\n" + out); } }
if (code !== 1) { f++; console.error("FAIL 应 exit 1, got", code); }
has("悬空goto", "检出悬空goto");
has("非法require键", "检出非法require");
has("未登记结局", "检出未登记ending");
has("非法颜色", "检出非法color");
has("非法节点ID", "检出非法ID");
console.log(f ? `${f}/${n} FAILED` : `ALL ${n} PASS`);
process.exit(f ? 1 : 0);
```

fixture `tools/fixtures/bad-story.js`:

```js
(function (g) {
  g.STORY.register("ch0", {
    "ch0_001": { text: "测试节点。", choices: [
      { text: "去一个不存在的地方", color: "red", goto: "ch0_999" },
      { text: "非法条件", color: "pink", require: { itemz: "x" }, goto: "ch0_002" }
    ]},
    "ch0_002": { text: "结局节点。", ending: "E99" },
    "bad_id_1": { text: "坏ID。" }
  });
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 4: 运行确认失败**

Run: `node tools/test-validate.js`
Expected: 报错(validate.js 不存在)。

- [ ] **Step 5: 实现 `tools/validate.js`**

```js
/* 用法: node tools/validate.js [剧情文件...]  不传参则读 js/story-index.js 清单 */
const path = require("path");
require("../js/core.js");
require("../js/story-registry.js");
const ROOT = path.join(__dirname, "..");

let files = process.argv.slice(2);
if (files.length === 0) {
  require(path.join(ROOT, "js/story-index.js"));
  files = globalThis.STORY_FILES;
}
for (const f of files) require(path.resolve(ROOT, f));

const S = globalThis.STORY;
const REQ_KEYS = ["item","noItem","flag","noFlag","hpAbove","hpBelow","sanAbove","sanBelow",
  "humanityAbove","humanityBelow","aff"];
const COLORS = ["white","red","green","blue","purple","gold"];
const ID_RE = /^(ch0|ch1|h2|r2|n2|s2|t2|f2|c3)_\d{3}$|^die_D\d{2}$|^end_E\d{2}$|^die_hp$/;
const errors = [];
let cjk = 0;
const countCjk = t => { const m = String(t).match(/[一-鿿　-〿＀-￯]/g); cjk += m ? m.length : 0; };

for (const id of Object.keys(S.nodes)) {
  const node = S.nodes[id];
  if (!ID_RE.test(id)) errors.push(`非法节点ID: ${id}`);
  countCjk(node.text || "");
  if (node.ending && !S.endings[node.ending]) errors.push(`未登记结局: ${id} -> ${node.ending}`);
  for (const c of node.choices || []) {
    countCjk(c.text || "");
    if (!COLORS.includes(c.color || "white")) errors.push(`非法颜色: ${id} -> ${c.color}`);
    if (!c.goto || !S.nodes[c.goto]) errors.push(`悬空goto: ${id} -> ${c.goto}`);
    for (const k of Object.keys(c.require || {})) if (!REQ_KEYS.includes(k)) errors.push(`非法require键: ${id} -> ${k}`);
    if (c.require && c.require.aff && !globalThis.CORE.AFF_NPCS.includes(c.require.aff.npc))
      errors.push(`非法require键: ${id} -> aff.${c.require.aff.npc}`);
  }
  if (!node.ending && (!node.choices || node.choices.length === 0) && !node.goto)
    errors.push(`死胡同节点(无choices/goto/ending): ${id}`);
}
console.log(`节点数: ${Object.keys(S.nodes).length}  正文+选项字数(CJK): ${cjk}`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("校验通过");
```

- [ ] **Step 6: 运行测试确认通过**

Run: `node tools/test-validate.js` → Expected: `ALL 5 PASS`
Run: `node tools/test-core.js` → Expected: 仍全通过

- [ ] **Step 7: Commit**

```bash
git add js/story-registry.js js/story-index.js tools/validate.js tools/test-validate.js tools/fixtures/bad-story.js
git commit -m "P1: STORY注册表与剧情静态校验器(含字数统计)"
```

---

### Task 3: save.js 存档系统(自动+5槽+导出导入+图鉴持久化)

**Files:**
- Create: `js/save.js`
- Test: `tools/test-save.js`

**Interfaces:**
- Consumes:无(storage 可注入,便于 Node 测试)
- Produces(挂到 `globalThis.SAVE`):
  - `SAVE.init(storageLike)`(默认 `localStorage`;测试传 mock)
  - `SAVE.auto(state)` / `SAVE.loadAuto() → state|null`
  - `SAVE.save(slot 1~5, state, chapterTitle)` / `SAVE.load(slot) → state|null` / `SAVE.del(slot)`
  - `SAVE.list() → [{slot, empty, chapterTitle, day, hp, san, savedAt}]`(长度恒为5)
  - `SAVE.exportCode(state) → string`(Base64) / `SAVE.importCode(code) → state`(非法抛 Error)
  - `SAVE.unlockEnding(eid)` / `SAVE.unlockedEndings() → string[]`(独立于存档,永久保留)
  - `SAVE.markChapter(chapterId)` / `SAVE.reachedChapters() → string[]`(章节回溯用,跨周目)

- [ ] **Step 1: 写失败测试 `tools/test-save.js`**

```js
// 运行: node tools/test-save.js
require("../js/core.js"); require("../js/save.js");
const S = globalThis.SAVE, C = globalThis.CORE;
const mem = {}; const mock = { getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
S.init(mock);
let n = 0, f = 0;
const eq = (a, b, m) => { n++; if (JSON.stringify(a) !== JSON.stringify(b)) { f++; console.error("FAIL", m, a, b); } };

eq(S.loadAuto(), null, "空自动档");
const st = C.newState(); st.node = "ch0_005"; st.hp = 42;
S.auto(st);
eq(S.loadAuto().hp, 42, "自动档往返");
S.save(3, st, "序章·写字楼");
eq(S.load(3).node, "ch0_005", "槽3往返");
eq(S.list().length, 5, "恒5槽");
eq(S.list()[2].chapterTitle, "序章·写字楼", "槽3元数据");
eq(S.list()[0].empty, true, "槽1为空");
S.del(3); eq(S.list()[2].empty, true, "删除槽3");
const code = S.exportCode(st);
eq(S.importCode(code).hp, 42, "导出导入往返");
let threw = false; try { S.importCode("垃圾数据!!"); } catch (e) { threw = true; }
eq(threw, true, "非法存档码抛错");
S.unlockEnding("D01"); S.unlockEnding("D01"); S.unlockEnding("E01");
eq(S.unlockedEndings().sort(), ["D01", "E01"], "图鉴解锁去重");
S.markChapter("ch0"); S.markChapter("ch1"); S.markChapter("ch0");
eq(S.reachedChapters(), ["ch0", "ch1"], "章节回溯记录");
console.log(f ? `${f}/${n} FAILED` : `ALL ${n} PASS`);
process.exit(f ? 1 : 0);
```

- [ ] **Step 2: 运行确认失败** — `node tools/test-save.js` → 报错。

- [ ] **Step 3: 实现 `js/save.js`**

```js
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
```

- [ ] **Step 4: 运行测试确认通过** — `node tools/test-save.js` → `ALL 14 PASS`(以实际断言数为准)。

- [ ] **Step 5: Commit**

```bash
git add js/save.js tools/test-save.js
git commit -m "P1: 存档系统(自动+5槽+存档码+图鉴/章节持久化)"
```

---

### Task 4: index.html + style.css(全部界面与6色选项样式)

**Files:**
- Create: `index.html`
- Create: `css/style.css`

**Interfaces:**
- Produces(供 engine.js 操作的 DOM 约定):
  - 五个屏:`#screen-title #screen-game #screen-saves #screen-gallery #screen-settings`,显隐由 class `active` 控制
  - 游戏屏:`#statusbar`(内含 `#st-hp #st-san #st-day #st-items`)、`#narrative`(正文容器)、`#choices`(选项容器)、`#float-layer`(飘字层)
  - 标题屏按钮:`#btn-new #btn-continue #btn-saves #btn-gallery #btn-settings`
  - 存档屏:`#save-slots`(5槽列表容器)、`#btn-export #btn-import #save-io-text`(textarea)
  - 选项按钮 class:`choice` + 颜色 class;锁定加 `locked`,锁文案放 `<span class="lock-reason">`
  - 弹幕/确认:`#modal`(通用确认框,含 `#modal-text #modal-ok #modal-cancel`)

- [ ] **Step 1: 写 `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="theme-color" content="#0b0d10">
<title>末班地铁</title>
<link rel="stylesheet" href="css/style.css">
</head>
<body>
<div id="screen-title" class="screen active">
  <div class="title-wrap">
    <h1 class="game-title">末班地铁</h1>
    <p class="game-sub">丧尸末日 · 文字冒险</p>
    <div class="title-menu">
      <button id="btn-new" class="menu-btn">新的一夜</button>
      <button id="btn-continue" class="menu-btn" disabled>继续</button>
      <button id="btn-saves" class="menu-btn">存档</button>
      <button id="btn-gallery" class="menu-btn">结局图鉴</button>
      <button id="btn-settings" class="menu-btn">设置</button>
    </div>
    <p class="title-quote">"加班到凌晨两点的人,不会第一时间发现世界完蛋了。"</p>
  </div>
</div>

<div id="screen-game" class="screen">
  <div id="statusbar">
    <span id="st-day">Day 0</span>
    <span id="st-hp">❤️60</span>
    <span id="st-san">🧠70</span>
    <span id="st-items" title="物品">🎒0</span>
    <button id="btn-game-menu" aria-label="菜单">☰</button>
  </div>
  <div id="narrative"></div>
  <div id="choices"></div>
  <div id="float-layer"></div>
</div>

<div id="screen-saves" class="screen">
  <h2 class="screen-h">存档</h2>
  <div id="save-slots"></div>
  <div class="save-io">
    <textarea id="save-io-text" placeholder="存档码…" rows="3"></textarea>
    <div class="row">
      <button id="btn-export" class="menu-btn small">导出当前进度</button>
      <button id="btn-import" class="menu-btn small">导入存档码</button>
    </div>
  </div>
  <button class="menu-btn back" data-back>返回</button>
</div>

<div id="screen-gallery" class="screen">
  <h2 class="screen-h">结局图鉴 <span id="gallery-count"></span></h2>
  <div id="gallery-grid"></div>
  <div id="gallery-detail" hidden></div>
  <button class="menu-btn back" data-back>返回</button>
</div>

<div id="screen-settings" class="screen">
  <h2 class="screen-h">设置</h2>
  <label class="set-row">文字速度
    <select id="set-speed">
      <option value="0">立即显示</option><option value="18" selected>正常</option>
      <option value="34">缓慢</option>
    </select></label>
  <label class="set-row">文字特效(抖动/闪烁)
    <input type="checkbox" id="set-fx" checked></label>
  <label class="set-row">章节回溯
    <select id="set-chapter"><option value="">(到达过的章节)</option></select></label>
  <button id="btn-chapter-go" class="menu-btn small">从该章重新开始</button>
  <button class="menu-btn back" data-back>返回</button>
</div>

<div id="modal" hidden>
  <div class="modal-box">
    <p id="modal-text"></p>
    <div class="row"><button id="modal-ok" class="menu-btn small">确定</button>
    <button id="modal-cancel" class="menu-btn small">取消</button></div>
  </div>
</div>

<script src="js/core.js"></script>
<script src="js/story-registry.js"></script>
<script src="js/story-index.js"></script>
<script src="js/save.js"></script>
<script src="js/typewriter.js"></script>
<script src="js/gallery.js"></script>
<script src="js/engine.js"></script>
</body>
</html>
```

(注:`story/*.js` 不写死在 HTML 里,由 engine.js 启动时按 `STORY_FILES` 动态注入 `<script>`,保证清单唯一来源。)

- [ ] **Step 2: 写 `css/style.css`**

完整样式,要点如下(实现时按此写全):

```css
:root {
  --bg:#0b0d10; --panel:#14181d; --text:#d8d3c8; --dim:#8a857b;
  --c-white:#d8d3c8; --c-red:#e0524d; --c-green:#6faa5e; --c-blue:#5d9bd4;
  --c-purple:#a26bd4; --c-gold:#d4a72c; --hp:#e0524d; --san:#5d9bd4;
}
* { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
html,body { margin:0; background:var(--bg); color:var(--text);
  font:17px/1.9 "Noto Serif SC","Songti SC",serif; }
.screen { display:none; min-height:100vh; padding:16px; max-width:640px; margin:0 auto; }
.screen.active { display:block; }

/* 标题屏 */
.game-title { font-size:44px; letter-spacing:12px; margin:18vh 0 0; text-align:center; }
.game-sub { text-align:center; color:var(--dim); letter-spacing:4px; }
.menu-btn { display:block; width:100%; min-height:48px; margin:12px 0; background:var(--panel);
  color:var(--text); border:1px solid #2a2f36; border-radius:8px; font:inherit; font-size:18px; }
.menu-btn:disabled { opacity:.35; }
.menu-btn.small { display:inline-block; width:auto; padding:0 18px; min-height:44px; font-size:16px; }
.title-quote { color:var(--dim); text-align:center; font-size:13px; margin-top:14vh; }

/* 状态栏 */
#statusbar { position:sticky; top:0; display:flex; gap:14px; align-items:center;
  background:rgba(11,13,16,.94); padding:10px 2px; border-bottom:1px solid #232830;
  font-size:15px; z-index:5; }
#st-hp { color:var(--hp); } #st-san { color:var(--san); }
#btn-game-menu { margin-left:auto; background:none; border:none; color:var(--dim);
  font-size:22px; min-width:44px; min-height:44px; }

/* 正文 */
#narrative { padding:18px 2px 8px; min-height:38vh; white-space:pre-wrap; }
#narrative .kw-item { color:var(--c-gold); } #narrative .kw-npc { color:var(--c-blue); }
#narrative .kw-red { color:var(--c-red); }

/* 选项:6色 + 锁定 */
.choice { display:block; width:100%; min-height:48px; margin:10px 0; padding:11px 14px;
  text-align:left; background:var(--panel); border-radius:8px; font:inherit; font-size:17px;
  border:1px solid #2a2f36; border-left-width:4px; color:var(--text); }
.choice.white { border-left-color:#555; }
.choice.red { border-left-color:var(--c-red); color:#eaa19e; }
.choice.green { border-left-color:var(--c-green); color:#b9d8ae; }
.choice.blue { border-left-color:var(--c-blue); color:#a9c9e8; }
.choice.purple { border-left-color:var(--c-purple); color:#cbaae8; animation:fadeInUp .8s; }
.choice.gold { border-left-color:var(--c-gold); color:#ecd9a0; animation:goldPulse 2s infinite; }
.choice.locked { opacity:.45; border-left-color:#333; color:var(--dim); }
.choice .lock-reason { display:block; font-size:13px; color:var(--dim); }
.choice.red:not(.locked) { animation:tremble 2.4s infinite; }

@keyframes goldPulse { 0%,100% { box-shadow:0 0 0 rgba(212,167,44,0); }
  50% { box-shadow:0 0 14px rgba(212,167,44,.45); } }
@keyframes tremble { 0%,94%,100% { transform:translateX(0); }
  95% { transform:translateX(1px); } 97% { transform:translateX(-1px); } }
@keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; } }

/* gold 抉择聚焦:engine 给 body 加 .gold-focus 时压暗正文 */
body.gold-focus #narrative { opacity:.35; transition:opacity .6s; }

/* 低理智 */
body.san-low #narrative { text-shadow:0 0 2px rgba(224,82,77,.35); }
.glitch { display:inline-block; animation:glitchShake .18s infinite; color:var(--c-red); }
@keyframes glitchShake { 0% { transform:translate(0,0);} 25% { transform:translate(1px,-1px);}
  50% { transform:translate(-1px,1px);} 100% { transform:translate(0,0);} }

/* 死亡渐染 */
body.dying::after { content:""; position:fixed; inset:0; pointer-events:none;
  background:radial-gradient(ellipse at center, transparent 30%, rgba(120,10,10,.55));
  animation:bleed 2.5s forwards; }
@keyframes bleed { from { opacity:0; } to { opacity:1; } }

/* 飘字 */
#float-layer { position:fixed; top:52px; right:14px; pointer-events:none; z-index:9; }
.float-note { animation:floatUp 1.6s forwards; font-size:15px; text-align:right; }
.float-note.neg { color:var(--c-red); } .float-note.pos { color:var(--c-green); }
@keyframes floatUp { from { opacity:0; transform:translateY(6px); }
  20% { opacity:1; } to { opacity:0; transform:translateY(-18px); } }

/* 图鉴 */
#gallery-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.g-cell { aspect-ratio:1; background:var(--panel); border-radius:8px; display:flex;
  flex-direction:column; align-items:center; justify-content:center; font-size:12px;
  border:1px solid #2a2f36; padding:4px; text-align:center; }
.g-cell.locked-cell { color:#3d434b; filter:blur(0); }
.g-cell.locked-cell .g-hint { filter:blur(2.5px); font-size:11px; }
.g-cell.unlocked.fate { border-color:var(--c-gold); color:var(--c-gold); }
.g-cell.unlocked.death { border-color:var(--c-red); color:var(--c-red); }

/* 存档/设置/弹窗 */
.save-slot { display:flex; justify-content:space-between; gap:8px; background:var(--panel);
  border:1px solid #2a2f36; border-radius:8px; padding:12px; margin:10px 0; min-height:48px; }
.save-slot .meta { color:var(--dim); font-size:13px; }
.set-row { display:flex; justify-content:space-between; align-items:center; min-height:48px; }
#save-io-text { width:100%; background:var(--panel); color:var(--text);
  border:1px solid #2a2f36; border-radius:8px; font-size:14px; }
#modal { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex;
  align-items:center; justify-content:center; z-index:99; }
.modal-box { background:var(--panel); border-radius:10px; padding:20px; max-width:86vw; }
.row { display:flex; gap:10px; justify-content:flex-end; }

@media (prefers-reduced-motion: reduce) {
  .choice.gold, .choice.red:not(.locked), .glitch, .float-note, body.dying::after,
  .choice.purple { animation:none !important; }
}
```

- [ ] **Step 3: 浏览器目测**

Run: `start index.html`(Windows 默认浏览器打开;engine 未写,仅标题屏可见)
Expected: 深色标题屏正常显示,按钮≥44px,无控制台 404 之外的报错(js 文件缺失属预期,下一任务补全;可容忍)。

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "P1: 全部界面骨架与6色选项样式(移动端优先)"
```

---

### Task 5: typewriter.js 打字机与文字特效

**Files:**
- Create: `js/typewriter.js`
- Test: `tools/test-typewriter.js`(仅测纯函数 parseMarkup)

**Interfaces:**
- Produces(挂到 `globalThis.TYPE`):
  - `TYPE.parseMarkup(text) → {html, plain}`:把 `{item:消防斧}` `{npc:老周}` `{red:文本}` 转成 `<span class="kw-item">消防斧</span>` 等;其余原样转义(`< > &`)。纯函数,Node 可测。
  - `TYPE.render(el, text, opts) → {skip()}`:打字机渲染。`opts={speed(ms/字,0=立即), fx(boolean), sanLow(boolean), onDone()}`。sanLow 且 fx 时:每~40字随机把一个字包 `<span class="glitch">`,并有 15% 概率在段尾插入一条 0.6s 后自动消失的血红幻觉短句(从内置数组抽,如"你没事的""还没下班吗")。点击 `el` 或调用 `skip()` 立即完成。

- [ ] **Step 1: 写失败测试 `tools/test-typewriter.js`**

```js
require("../js/typewriter.js");
const T = globalThis.TYPE;
let n = 0, f = 0;
const eq = (a, b, m) => { n++; if (a !== b) { f++; console.error("FAIL", m, "\n", a, "\n!=\n", b); } };
eq(T.parseMarkup("拿到{item:消防斧}。").html, '拿到<span class="kw-item">消防斧</span>。', "item标记");
eq(T.parseMarkup("{npc:老周}皱眉。").html, '<span class="kw-npc">老周</span>皱眉。', "npc标记");
eq(T.parseMarkup("{red:快跑}!").html, '<span class="kw-red">快跑</span>!', "red标记");
eq(T.parseMarkup("a<b&c").html, "a&lt;b&amp;c", "转义");
eq(T.parseMarkup("拿到{item:消防斧}。").plain, "拿到消防斧。", "plain剥离");
console.log(f ? `${f}/${n} FAILED` : `ALL ${n} PASS`);
process.exit(f ? 1 : 0);
```

- [ ] **Step 2: 运行确认失败** — `node tools/test-typewriter.js` → 报错。

- [ ] **Step 3: 实现 `js/typewriter.js`**

```js
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
```

- [ ] **Step 4: 运行测试确认通过** — `node tools/test-typewriter.js` → `ALL 5 PASS`。

- [ ] **Step 5: Commit**

```bash
git add js/typewriter.js tools/test-typewriter.js
git commit -m "P1: 打字机与低理智文字特效"
```

---

### Task 6: engine.js 渲染与流程核心

**Files:**
- Create: `js/engine.js`

**Interfaces:**
- Consumes:`CORE.*`、`SAVE.*`、`TYPE.render`、`STORY.nodes/chapters/endings`、`STORY_FILES`、Task 4 的 DOM 约定
- Produces(挂到 `window.ENGINE`,供 gallery/调试用):
  - `ENGINE.state` 当前状态
  - `ENGINE.goto(nodeId)` 进入节点(结算effects→自动存档→渲染)
  - `ENGINE.newGame()` / `ENGINE.continueGame()` / `ENGINE.show(screenId)`
  - `ENGINE.settings → {speed, fx}`(读写 localStorage `mbdt_settings`)

**行为规则(实现依据,不得偏离):**
1. 启动:按 `STORY_FILES` 顺序动态注入 `<script>`,全部 onload 后启用标题屏按钮;有自动档则点亮"继续"。
2. `goto(id)`:取节点→`applyEffects(node.effects)`→数值变化经 `#float-layer` 飘字(格式 `理智 -5`,负红正绿)→更新状态栏→`state.node=id`、`state.visited.push(id)`→若节点所在章节未记录,`SAVE.markChapter`→**先判死**:`hp<=0` 跳 `die_hp`,`san<=0` 跳 `die_D10`(本节点本身是结局节点则不跳)→`SAVE.auto(state)`→渲染正文(`TYPE.render`,`sanLow: state.san<30`,渲染前 body 按 `san<30` 切换 class `san-low`)→正文完成后渲染choices。
3. choices渲染:每项 `CORE.checkRequire`;不满足且 `c.hideWhenLocked` 未设→渲染 `locked`(按钮禁用,`lock-reason` 显示 missing 拼接);满足→可点,点击先结算 `c.effects` 再 `goto(c.goto)`。含 gold 选项的节点:body 加 `gold-focus`,并在choices顶部插入一行提示 `<p class="gold-tip">此选择将改变你的命运</p>`(样式:金色,小号,居中——补进 style.css)。离开节点时移除 `gold-focus`。
4. 结局节点(`node.ending` 存在):`SAVE.unlockEnding(ending)`;body 加 `dying`(仅 D 系与 die_hp);正文后不渲染choices,渲染两个按钮:「回到标题」「结局图鉴」;同时显示结局编号+名称(从 `STORY.endings` 取,如 `结局 D01·加班到死`)。
5. 无 `choices` 但有 `node.goto`:正文完成后显示单按钮「▼ 继续」。
6. `newGame()`:弹 `#modal` 确认覆盖自动档→`state=CORE.newState()`→`goto(STORY.chapters["ch0"].start)`。
7. 存档屏:渲染 `SAVE.list()`;非空槽给「读档」「覆盖」「删除」,空槽给「存入」;游戏中打开才允许存;导出导入接 `SAVE.exportCode/importCode`,导入成功直接进入该 state(`goto(state.node)` 但**不重复结算 effects**——导入/读档恢复用 `render(id, {skipEffects:true})` 路径)。
8. 设置屏:速度/特效开关持久化;章节回溯下拉列出 `SAVE.reachedChapters()` 对应 `STORY.chapters` 标题,确认后以全新 state 从该章 start 开始(hp/san 重置为初始——P1 只有 ch0,规则先立好)。
9. 死亡兜底节点 `die_hp`(无 ending 字段,不入图鉴)由 endings.js 提供文本:力竭倒下的通用尾声+「回到标题」。

- [ ] **Step 1: 实现 `js/engine.js`**(按上述9条规则完整实现;单文件≤400行;`goto` 与 `render(id,{skipEffects})` 分离是关键)

- [ ] **Step 2: 加载冒烟测试(临时剧情)**

创建 `story/endings.js` 的最小占位(下个任务会写全)+ 临时在浏览器控制台验证:

```js
// story/endings.js 最小版
(function (g) {
  g.STORY.registerEndings({ D10: { name: "都是同事", hint: "当理智归零", type: "death" } });
  g.STORY.register("end", {}); // 占位
  g.STORY.register("die", {
    "die_hp": { text: "你的身体先于意志放弃了。\n\n你靠着墙滑坐下去,像每一个加完班的深夜那样闭上眼。\n这一次,没有闹钟会再叫醒你。" },
    "die_D10": { text: "你笑了起来。\n\n他们摇摇晃晃地朝你走来,西装,工牌,拖着脚。\n都是同事啊,你想,原来大家都没下班。\n你张开手臂,走进了早高峰的人流里。", ending: "D10" }
  });
})(typeof window !== "undefined" ? window : globalThis);
```

再建 `story/ch0-prologue.js` 临时两节点(带一个 red 选项扣 san 到 0)自测:标题屏→新游戏→节点渲染→打字机→选项→飘字→死亡→图鉴解锁 alert 无报错。
Run: `start index.html` 手工走查 + `node tools/validate.js`
Expected: 校验通过(临时节点符合ID规范),浏览器全流程无控制台报错。

- [ ] **Step 3: Commit**

```bash
git add js/engine.js story/endings.js story/ch0-prologue.js
git commit -m "P1: 引擎渲染与流程核心(含临时冒烟剧情)"
```

---

### Task 7: gallery.js 结局图鉴 + endings.js 28条元数据

**Files:**
- Create: `js/gallery.js`
- Modify: `story/endings.js`(补全28条元数据;E01~E18 与 D01~D09 的正文节点在后续阶段交付,先只登记元数据+已实现的 D01/D02/D10 文本)

**Interfaces:**
- Consumes:`STORY.endings`、`SAVE.unlockedEndings()`
- Produces:`GALLERY.open()` 渲染 `#gallery-grid` 28格(顺序 E01..E18, D01..D10);`#gallery-count` 显示 `已解锁 x / 28`;解锁格点击→`#gallery-detail` 显示结局全文(从节点 `end_Exx`/`die_Dxx` 取,若正文节点未交付则显示"(本结局将在后续版本开放)");未解锁格显示 `? ??` 剪影 + 模糊 hint。

- [ ] **Step 1: 补全 `story/endings.js` 28条元数据**

28条 `name/hint/type` 全部按设计文档 §6 填写,hint 是不剧透的一句话谜语,示例格式:

```js
g.STORY.registerEndings({
  E01: { name: "围城之火", hint: "有人把家守成了篝火。", type: "fate" },
  // …… E02~E18 逐条(名称抄设计文档,hint 现场创作,不留空)
  D01: { name: "加班到死", hint: "打卡机还在响。", type: "death" },
  // …… D02~D10 逐条
  E18: { name: "回到工位", hint: "27/28:他最后回到了最开始的地方。", type: "fate" }
});
```

- [ ] **Step 2: 实现 `js/gallery.js`**(按 Interfaces;60~90行)

- [ ] **Step 3: 手工验证**

Run: `start index.html`,先跑一次 D10 死亡再开图鉴。
Expected: 28格齐全;D10 亮红框可读全文;其余剪影+模糊hint;计数 `已解锁 1 / 28`。
Run: `node tools/validate.js` → 校验通过。

- [ ] **Step 4: Commit**

```bash
git add js/gallery.js story/endings.js
git commit -m "P1: 结局图鉴与28结局元数据"
```

---

### Task 8: 序章剧情·上半(加班夜与爆发,ch0_001~ch0_034)

**Files:**
- Modify: `story/ch0-prologue.js`(删临时节点,换正式剧情)

**Interfaces:**
- Produces:`STORY.registerChapter("ch0", { title: "序章·写字楼", start: "ch0_001" })`;节点 `ch0_001`~`ch0_034`;出口:`ch0_030`(主动线,接下半)、`die_D01`、可获物品 `keycard`(必得,剧情自然给)。
- 本段目标字数:**≥12000字**(validate.js 统计口径)。

**场景大纲(节点级,写作时按写作规范展开成100~300字/节点):**
- `ch0_001~006` 凌晨1:40,22层,版本上线前夜。工位环境、同事群像(测试组的老赵、应届生许乐还在)、手机里程霜的未读消息与母亲的语音。第一个选择:回不回程霜消息(aff_cheng±、flag `msg_cheng`)。埋:楼道消毒水味、21层昆仑生物的快递堆、陈默手臂针疤一句带过。
- `ch0_007~014` 异变:茶水间的呕吐声、老赵"低烧请假"未走、灯灭一半、内网弹出物业通知。调查线(blue,+clue_lab flag)/装没看见继续改bug(humanity-5)/去茶水间看老赵(触发第一次遭遇)。
- `ch0_015~022` 爆发:老赵咬穿主管喉咙的目击场面(san-10~-15,视选择)。躲工位隔间(通向 D01 的诱惑分支:选"等公司通知"两次→`die_D01`)/拉许乐一起跑(aff_xule+2)/独自跑(humanity-10)。
- `ch0_023~030` 22层混乱逃生,走廊遭遇战教学:红选项(硬闯,hp-15风险)/绿选项(会议室躲避,耗时)/蓝选项(观察丧尸趋声特性,+flag `learn_sound`,后续节点可用紫选项"扔手机引开")。`ch0_028` 拿到消防斧(消防栓,item +fireAxe 可选拿)。`ch0_030` 到达电梯厅=本段出口。
- `ch0_031~034` D01 铺垫节点与旁支(留在工位的两步升级、给老板发消息等无人回应的细节)。
- gold抉择本段0个(留给下半)。

- [ ] **Step 1: 写节点(删临时剧情,保留 die_D01 文本并写全:变成丧尸后每天"准时到岗"的完整尾声,300~500字)**
- [ ] **Step 2: 校验与字数** — Run: `node tools/validate.js` → 校验通过且 CJK 字数比上次提交增加 ≥12000。
- [ ] **Step 3: 浏览器走查** — 从新游戏走到 ch0_030 与 die_D01 两条路,无报错、锁定选项显示正确。
- [ ] **Step 4: Commit** — `git commit -m "P1: 序章上半·加班夜与爆发(1.2万+字)"`

---

### Task 9: 序章剧情·下半(逃生三路+老周+出楼,ch0_035~ch0_080)

**Files:**
- Modify: `story/ch0-prologue.js`

**Interfaces:**
- Produces:节点 `ch0_035~ch0_080`;`die_D02` 完整文本;序章终点 `ch0_080`(尾声钩子,P2 在此接 `ch1_001`,当前渲染"第一幕·雨夜穿城 即将到来"的剧情化封锁文案+回标题按钮,**不设 goto**,不算死胡同:给 `node.endOfContent=true`,engine 对该字段渲染封锁提示——在本任务中给 engine 加这个小分支)。
- 本段目标字数:**≥15000字**。

**场景大纲:**
- `ch0_035` 电梯厅,**gold抉择①:下楼方式** — 电梯(red,通向 `die_D02` 的完整支线:停电困梯,黑暗独白结局)/消防楼梯(主线)/天台看情况(blue,可俯瞰全城灾情,san-8 但 +flag `saw_city`,后续对话选项差异)。
- `ch0_036~050` 楼梯间22层→1层分楼层遭遇:18层带伤白领求助(救/不救,humanity±10,救则hp风险+aff线索)、9层保安室遇**老周**(核心:老周教两条生存规则=机制教学复述;aff_zhou 累积;老周给或不给收音机 radio 取决于对话选择)。
- `ch0_051~062` 一层大堂:玻璃门外雨幕与人影,康明远带保镖抢先开走商务车的目击(flag `saw_kang`,后续安置区线callback)。出楼三选:正门冲(red)/地库(蓝,需 keycard,遇许乐躲车底支线)/消防通道(绿,与老周同行)。
- `ch0_063~075` 台风雨夜街头初体验:雨掩盖气味的机制教学(flag `learn_rain`)、第一次亲手了结一只丧尸的抉择(不同选择 san/humanity 差异化,是序章人性基调定调点)、**gold抉择②:去向**(白石洲找阿凯=主线出口/先去公司楼下药店搜刮=物品收益+风险)。
- `ch0_076~080` 收束到 `ch0_080` 尾声:湿透的你回望科技园,手机弹出程霜3小时前的最后消息。钩子文本+封锁提示。
- `die_D02` 支线3节点:按按钮→骤停→黑暗;独白型死亡结局(手机没电百分比倒数的写法,300~500字)。

- [ ] **Step 1: engine.js 加 `endOfContent` 渲染分支**(封锁提示样式:虚线框灰字,补进 style.css)
- [ ] **Step 2: 写节点**
- [ ] **Step 3: 校验与字数** — `node tools/validate.js` → 通过,累计新增 ≥15000;全部测试 `node tools/test-core.js && node tools/test-save.js && node tools/test-typewriter.js && node tools/test-validate.js` 通过。
- [ ] **Step 4: 浏览器走查** — 三条下楼路+D02+两个gold抉择+紫选项(learn_sound触发)全走一遍。
- [ ] **Step 5: Commit** — `git commit -m "P1: 序章下半·逃生与出楼(1.5万+字)"`

---

### Task 10: 打包脚本 + README + 手机实测

**Files:**
- Create: `tools/build.js`
- Create: `README.md`

**Interfaces:**
- `tools/build.js`:读 index.html,把所有 `<link rel=stylesheet>` 与 `<script src>`(含 STORY_FILES 动态清单)内联,产出 `offline.html`(单文件,双击可玩)。Run: `node tools/build.js` → `offline.html 已生成 (xxx KB)`。
- `README.md`:游戏简介、本地游玩方式、`node tools/validate.js` 字数统计用法、GitHub Pages 部署三步(创建仓库→push→Settings/Pages 选 main 分支)、阶段路线图(P1~P6,当前P1)。

- [ ] **Step 1: 实现 build.js 并运行**,产出的 offline.html 在浏览器完整走一遍序章。
- [ ] **Step 2: 写 README.md。**
- [ ] **Step 3: 手机实测**:同一局域网起 `python -m http.server` 或直接把 offline.html 发到手机,竖屏走查:字号、点击区、打字机点击跳过、存档5槽、导出导入、图鉴。发现的样式问题就地修复。
- [ ] **Step 4: 全量回归** — 四个 node 测试 + validate 全绿;`git add -A && git commit -m "P1: 打包脚本、README与移动端实测修正"`。

---

## Self-Review 结果

- **Spec覆盖**:引擎(T1/2/5/6)、存档5槽+导入导出(T3)、UI/6色/动效/reduced-motion(T4/5)、图鉴28格(T7)、序章+D01/D02(T8/9)、打包/部署文档(T10)。P1 范围内无缺口;E01~E18 等结局正文属 P3~P6,按设计文档阶段表不在本计划。
- **Placeholder扫描**:engine.js(T6)与 gallery.js(T7)未给全文代码,但行为规则已逐条写死(9条规则+接口约定),属"规格完整、代码留给执行者"的内容型任务;剧情任务同理(节点级大纲+字数验收)。无 TBD/TODO。
- **类型一致性**:`CORE.checkRequire/applyEffects`、`SAVE.*`、`TYPE.parseMarkup/render`、`STORY.register*` 的签名在 T1/2/3/5 定义与 T6/7 消费处一致;localStorage 键统一 `mbdt_` 前缀;颜色 class 与 CSS 一致。
