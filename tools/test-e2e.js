/* 端到端冒烟:jsdom 加载真实 index.html + 全部脚本,模拟点击走通剧情。
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
const clickChoice = i => {
  const btns = [...w.document.querySelectorAll("#choices .choice:not(.locked)")];
  ok(btns.length > 0, "存在可点选项");
  (btns[i] || btns[0]).click();
};

// 启动(手动 bindUI,跳过动态脚本注入)
w.ENGINE.settings.speed = 0; // 立即渲染,同步可断言
w.ENGINE.bindUI();
ok($("btn-continue").disabled, "无自动档时继续置灰");

// 新游戏 → 首节点
w.ENGINE.newGame();
ok($("screen-game").classList.contains("active"), "进入游戏屏");
ok($("narrative").textContent.includes("凌晨"), "首节点正文渲染");
ok(w.document.querySelectorAll("#choices .choice").length === 3, "三个选项");

// 蓝选项 → flag + 自动推进链
clickChoice(0);
ok(w.ENGINE.state.flags.includes("clue_lab"), "选项effects生效(flag)");
ok(w.ENGINE.state.items.includes("keycard"), "节点effects生效(物品)");
ok($("st-items").textContent === "🎒1", "状态栏物品数");
// ch0_002 无choices → 「▼ 继续」按钮
const contBtn = [...w.document.querySelectorAll("#choices .menu-btn")].find(b => b.textContent.includes("继续"));
ok(!!contBtn, "直连节点显示继续按钮");
contBtn.click();
ok($("choices").textContent.includes("下个版本"), "endOfContent封锁提示");
ok(w.SAVE.loadAuto() && w.SAVE.loadAuto().node === "ch0_003", "自动存档跟随");

// 存档5槽 + 导出导入
w.ENGINE.renderSaves && w.ENGINE.renderSaves();
w.SAVE.save(2, w.ENGINE.state, "序章·写字楼");
ok(w.SAVE.list()[1].empty === false, "槽2已存");
const code = w.SAVE.exportCode(w.ENGINE.state);
ok(w.SAVE.importCode(code).node === "ch0_003", "存档码往返");

// 理智归零 → die_D10 → 图鉴解锁
w.ENGINE.newGame();
clickChoice(2); // red 选项 san-60(初始70,节点ch0_002无san扣减→仍>0),再补一刀
w.CORE.applyEffects({ san: -99 }, w.ENGINE.state);
w.ENGINE.goto("ch0_002"); // 进入时判死 → die_D10
ok($("narrative").textContent.includes("都是同事") || $("choices").textContent.includes("D10"), "理智归零跳转D10");
ok(w.SAVE.unlockedEndings().includes("D10"), "结局D10解锁入图鉴");
ok(w.document.body.classList.contains("dying"), "死亡渐染class");

// 读档恢复(render 不重复结算 effects)
const before = w.SAVE.load(2);
w.ENGINE.state = before;
w.ENGINE.render(before.node, { skipEffects: true });
ok(w.ENGINE.state.items.length === before.items.length, "读档不重复结算");
ok($("screen-game") && $("narrative").textContent.length > 0, "读档后正文渲染");

console.log(f ? `${f}/${n} FAILED` : `ALL ${n} PASS`);
process.exit(f ? 1 : 0);
