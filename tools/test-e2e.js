/* 端到端冒烟:jsdom 加载真实 index.html + 全部脚本,模拟点击走通剧情。
   剧情无关:自动走图 + 基于真实节点的机制断言。
   运行: node tools/test-e2e.js */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const ROOT = path.join(__dirname, "..");

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
  .replace(/<script src="[^"]*"><\/script>\s*/g, ""); // 脚本手动注入,避免 jsdom 网络加载
const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;

function evalFile(rel) {
  w.eval(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}
["js/core.js", "js/story-registry.js", "js/story-index.js", "js/save.js",
 "js/typewriter.js", "js/gallery.js", "js/engine.js"].forEach(evalFile);
w.STORY_FILES.forEach(evalFile); // 剧情文件直接注入,绕过 <script> 动态加载

let n = 0, f = 0;
const ok = (cond, msg) => { n++; if (!cond) { f++; console.error("FAIL", msg); } };
const $ = id => w.document.getElementById(id);
const enabledChoices = () => [...w.document.querySelectorAll("#choices .choice:not(.locked)")];
const contBtn = () => [...w.document.querySelectorAll("#choices .menu-btn")]
  .find(b => b.textContent.includes("继续"));

// 启动(手动 bindUI,跳过动态脚本注入)
w.ENGINE.settings.speed = 0; // 立即渲染,同步可断言
w.ENGINE.bindUI();
ok($("btn-continue").disabled, "无自动档时继续置灰");

// ---------- 通用走图:随机点第一个可用选项,直到结局/封锁,重复多轮 ----------
function walk(pick) {
  w.ENGINE.newGame();
  for (let step = 0; step < 300; step++) {
    const node = w.STORY.nodes[w.ENGINE.state.node];
    if (node.ending || node === w.STORY.nodes["die_hp"]) return "ending:" + (node.ending || "hp");
    if (node.endOfContent) return "eoc";
    const c = contBtn();
    if (c) { c.click(); continue; }
    const btns = enabledChoices();
    if (btns.length === 0) return "stuck@" + w.ENGINE.state.node;
    btns[pick % btns.length].click();
  }
  return "loop";
}
for (let i = 0; i < 8; i++) {
  const r = walk(i);
  ok(r === "eoc" || r.startsWith("ending:"), `走图${i}正常终止(实际:${r})`);
}

// ---------- 机制断言(锚定真实节点) ----------
w.ENGINE.newGame();
ok($("screen-game").classList.contains("active"), "进入游戏屏");
ok($("narrative").textContent.length > 20, "首节点正文渲染");
ok(enabledChoices().length >= 2, "首节点有选项");
enabledChoices()[0].click(); // 回程霜消息
ok(w.ENGINE.state.flags.includes("msg_cheng"), "选项effects生效(flag)");
ok(w.ENGINE.state.aff.cheng === 1, "选项effects生效(好感)");
w.ENGINE.goto("ch0_005");
ok(w.ENGINE.state.items.includes("keycard"), "节点effects生效(门禁卡)");
ok($("st-items").textContent === "🎒1", "状态栏物品数");
ok(w.SAVE.loadAuto() && w.SAVE.loadAuto().node === "ch0_005", "自动存档跟随");

// 锁定选项:ch0_030 的紫选项需要 saved_fangwen
w.ENGINE.goto("ch0_030");
const lockedBtns = [...w.document.querySelectorAll("#choices .choice.locked")];
ok(lockedBtns.length === 1 && lockedBtns[0].textContent.includes("🔒"), "未满足条件的紫选项锁定并显示原因");
w.CORE.applyEffects({ flag: "saved_fangwen" }, w.ENGINE.state);
w.ENGINE.render("ch0_030", { skipEffects: true });
ok(w.document.querySelectorAll("#choices .choice.locked").length === 0, "满足条件后紫选项解锁");

// 存档5槽 + 导出导入
w.SAVE.save(2, w.ENGINE.state, "序章·写字楼");
ok(w.SAVE.list()[1].empty === false, "槽2已存");
const code = w.SAVE.exportCode(w.ENGINE.state);
ok(w.SAVE.importCode(code).node === w.ENGINE.state.node, "存档码往返");

// 理智归零 → die_D10;体魄归零 → die_hp
w.ENGINE.newGame();
w.CORE.applyEffects({ san: -99 }, w.ENGINE.state);
w.ENGINE.goto("ch0_005");
ok($("narrative").textContent.includes("都是同事") || w.ENGINE.state.node === "die_D10", "理智归零跳转D10");
ok(w.SAVE.unlockedEndings().includes("D10"), "结局D10解锁入图鉴");
ok(w.document.body.classList.contains("dying"), "死亡渐染class");
w.ENGINE.newGame();
w.CORE.applyEffects({ hp: -99 }, w.ENGINE.state);
w.ENGINE.goto("ch0_005");
ok(w.ENGINE.state.node === "die_hp", "体魄归零跳转die_hp");

// D01 定向走查:桌底 → 等待线 → 加班到死
w.ENGINE.newGame();
w.ENGINE.goto("ch0_015");
enabledChoices()[0].click(); // 钻进桌底 ch0_016
enabledChoices()[0].click(); // 继续等 ch0_035
enabledChoices()[0].click(); // 再等等 ch0_036
enabledChoices()[1].click(); // 等官方救援 → die_D01
ok(w.ENGINE.state.node === "die_D01", "D01死亡结局可达");
ok(w.SAVE.unlockedEndings().includes("D01"), "D01解锁入图鉴");

// 第一幕衔接:序章末尾直连 ch1_001(不再是 endOfContent 死结)
ok(!w.STORY.nodes["ch0_080"].endOfContent && w.STORY.nodes["ch0_080"].goto === "ch1_001", "序章直连第一幕");
ok(w.STORY.chapters["ch1"] && w.STORY.nodes["ch1_001"], "第一幕已注册");

// D03 好心人:四楼劫匪 → 硬挣脱身亡
w.ENGINE.state = w.CORE.newState();
w.ENGINE.goto("ch1_009");
[...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("赌他")).click();
ok(w.ENGINE.state.node === "die_D03", "D03死亡结局可达");
ok(w.SAVE.unlockedEndings().includes("D03"), "D03解锁入图鉴");

// D04 坠雨:六楼翻窗跨天台坠落
w.ENGINE.state = w.CORE.newState();
w.ENGINE.goto("ch1_014");
[...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("外墙")).click();
ok(w.ENGINE.state.node === "die_D04", "D04死亡结局可达");

// D05 幻听:五楼低理智幻听开门(紫选项需 san<30)
w.ENGINE.state = w.CORE.newState();
w.CORE.applyEffects({ san: -50 }, w.ENGINE.state); // 压到低理智
w.ENGINE.render("ch1_012", { skipEffects: true });
const hallucBtn = [...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("鬼使神差"));
ok(!!hallucBtn, "低理智解锁幻听紫选项");
hallucBtn.click();
ok(w.ENGINE.state.node === "die_D05", "D05死亡结局可达");
// 高理智时该紫选项应锁定
w.ENGINE.state = w.CORE.newState(); // san=70
w.ENGINE.render("ch1_012", { skipEffects: true });
ok([...w.document.querySelectorAll("#choices .choice.locked")].some(b => b.textContent.includes("鬼使神差")), "高理智时幻听选项锁定");

// 六线 gold 分岔:四条明线各自可选并进入对应封锁尾
w.ENGINE.state = w.CORE.newState();
w.ENGINE.goto("ch1_026");
const goldBtns = [...w.document.querySelectorAll("#choices .choice.gold")];
ok(goldBtns.length === 4, "第一幕末尾四个金色命运抉择");
ok(w.document.body.classList.contains("gold-focus"), "gold聚焦生效");
goldBtns.find(b => b.textContent.includes("罗湖")).click(); // 寻人线
ok(w.ENGINE.state.flags.includes("route_rescue"), "选择寻人线设置route标记");
ok($("choices").textContent.includes("寻人线"), "进入寻人线封锁尾");

// 结局图鉴:28格、解锁态、详情
w.GALLERY.open();
ok(w.document.querySelectorAll("#gallery-grid .g-cell").length === 28, "图鉴28格");
const unlockedCount = w.SAVE.unlockedEndings().length;
ok($("gallery-count").textContent.includes(unlockedCount + " / 28"), "解锁计数");
const cells = [...w.document.querySelectorAll("#gallery-grid .g-cell")];
cells[27].click(); // D10
ok(!$("gallery-detail").hidden && $("gallery-detail").textContent.includes("都是同事"), "详情显示结局全文");
ok(cells.some(c => c.textContent.includes("???")), "未解锁显示剪影");

// 读档恢复(render 不重复结算 effects)
const before = w.SAVE.load(2);
w.ENGINE.state = before;
w.ENGINE.render(before.node, { skipEffects: true });
ok(w.ENGINE.state.items.length === before.items.length, "读档不重复结算");
ok($("narrative").textContent.length > 0, "读档后正文渲染");

console.log(f ? `${f}/${n} FAILED` : `ALL ${n} PASS`);
process.exit(f ? 1 : 0);
