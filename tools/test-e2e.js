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
ok(goldBtns.length === 5, "第一幕末尾五个金色命运抉择(守/寻/走/海/安置区)");
ok(w.document.body.classList.contains("gold-focus"), "gold聚焦生效");
goldBtns.find(b => b.textContent.includes("罗湖")).click(); // 寻人线
ok(w.ENGINE.state.flags.includes("route_rescue"), "选择寻人线设置route标记");
ok(w.ENGINE.state.node === "ch1_091", "寻人线经过场进入第二幕");
if (contBtn()) contBtn().click();
ok(w.ENGINE.state.node === "r2_001", "寻人线直接流入第二幕(不再封锁)");

// —— 第二幕·寻人线:三结局 + D07 ——
// E06 迟到的人:途中救天桥 → 迟到
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("r2_002");
[...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("救他们")).click();
while (contBtn()) contBtn().click();
ok(w.ENGINE.state.node === "end_E06", "寻人线E06(迟到的人)可达");
ok(w.SAVE.unlockedEndings().includes("E06"), "E06解锁");
// E05 平安喜乐:直奔→地铁隧道→跳过地下→带走病人
w.ENGINE.state = w.CORE.newState(); w.CORE.applyEffects({ humanity: 20 }, w.ENGINE.state);
w.ENGINE.goto("r2_002");
[...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("别停")).click();
[...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("地铁隧道")).click();
while (contBtn()) contBtn().click();
[...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("往上走")).click();
while (contBtn()) contBtn().click();
[...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("都带上")).click();
while (contBtn()) contBtn().click();
ok(w.ENGINE.state.node === "end_E05", "寻人线E05(平安喜乐)可达");
ok(w.SAVE.unlockedEndings().includes("E05"), "E05解锁");
// D07 地下三层:下地下 → 举烛硬闯
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("r2_011");
[...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("下去看")).click();
while (contBtn()) contBtn().click();
[...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("举着蜡烛")).click();
ok(w.ENGINE.state.node === "die_D07", "寻人线D07(地下三层)可达");
// E04 向死而生:走高架(引尸潮)→ 程霜被感染
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("r2_003");
[...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("上高架桥")).click();
while (contBtn()) contBtn().click();
// r2_021→r2_040→r2_041→end_E04 全是继续
let guard = 0;
while (w.ENGINE.state.node !== "end_E04" && guard++ < 20) {
  if (contBtn()) { contBtn().click(); continue; }
  const b = enabledChoices()[0]; if (b) b.click(); else break;
}
ok(w.ENGINE.state.node === "end_E04", "寻人线E04(向死而生)可达");

// —— 第二幕·固守线:三结局(靠人性值gate) ——
// E01 围城之火:高人性
w.ENGINE.state = w.CORE.newState(); w.CORE.applyEffects({ humanity: 40 }, w.ENGINE.state);
w.ENGINE.goto("h2_020");
let e01 = [...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("肩并肩"));
ok(!!e01, "高人性解锁E01终局选项"); e01.click();
ok(w.ENGINE.state.node === "end_E01", "固守线E01(围城之火)可达");
// E03 围城之王:低人性
w.ENGINE.state = w.CORE.newState(); w.CORE.applyEffects({ humanity: -40 }, w.ENGINE.state);
w.ENGINE.goto("h2_020");
let e03 = [...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(b => b.textContent.includes("亲手结果"));
ok(!!e03, "低人性解锁E03终局选项"); e03.click();
ok(w.ENGINE.state.node === "end_E03", "固守线E03(围城之王)可达");
// E02 人去楼空:中性(E01/E03均锁定,只剩E02)
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("h2_020");
ok([...w.document.querySelectorAll("#choices .choice.locked")].length === 2, "中性人性时E01/E03均锁定");
[...w.document.querySelectorAll("#choices .choice:not(.locked)")][0].click();
ok(w.ENGINE.state.node === "end_E02", "固守线E02(人去楼空)可达");

// 便捷:按关键字点击可用选项
const pick = kw => {
  const b = [...w.document.querySelectorAll("#choices .choice:not(.locked)")].find(x => x.textContent.includes(kw));
  ok(!!b, "存在选项:" + kw); if (b) b.click();
};
const runTo = (target, max) => { let g = 0; while (w.ENGINE.state.node !== target && g++ < (max||30)) {
  if (contBtn()) { contBtn().click(); continue; } const b = enabledChoices()[0]; if (b) b.click(); else break; } };

// —— 撤离线:E07/E08/E09/D06 ——
w.ENGINE.state = w.CORE.newState(); w.CORE.applyEffects({ humanity: 20 }, w.ENGINE.state);
w.ENGINE.goto("n2_011"); pick("如实登记"); runTo("end_E07");
ok(w.ENGINE.state.node === "end_E07", "撤离线E07(一路向北)可达");
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("n2_011"); pick("留下断后"); runTo("end_E08");
ok(w.ENGINE.state.node === "end_E08", "撤离线E08(半路家书)可达");
w.ENGINE.state = w.CORE.newState(); w.CORE.applyEffects({ flag: "join_convoy" }, w.ENGINE.state);
w.ENGINE.goto("n2_011"); pick("掉头"); ok(w.ENGINE.state.node === "end_E09", "撤离线E09(车队领袖)可达");
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("n2_010"); pick("独自走进夜里");
ok(w.ENGINE.state.node === "die_D06", "撤离线D06(潜伏期)可达");

// —— 海路线:E10/E11/E12 ——
w.ENGINE.state = w.CORE.newState(); w.CORE.applyEffects({ flag: "met_coastguard" }, w.ENGINE.state);
w.ENGINE.goto("s2_011"); pick("跟着海警"); ok(w.ENGINE.state.node === "end_E11", "海路线E11(灯塔)可达");
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("s2_011"); pick("自己去闯");
ok(w.ENGINE.state.node === "end_E10", "海路线E10(无岸之海)可达");
w.ENGINE.state = w.CORE.newState(); w.CORE.applyEffects({ humanity: -30 }, w.ENGINE.state);
w.ENGINE.goto("s2_002"); pick("那小丫头"); pick("成交"); runTo("end_E12");
ok(w.ENGINE.state.node === "end_E12", "海路线E12(偷渡客)可达");

// —— 真相线:隐藏入口(clue_immune)+ E13/E14/E15 ——
w.ENGINE.state = w.CORE.newState(); w.CORE.applyEffects({ flag: "clue_immune" }, w.ENGINE.state);
w.ENGINE.goto("ch1_026");
ok([...w.document.querySelectorAll("#choices .choice")].some(b => b.textContent.includes("昆仑生物")), "有线索时解锁真相线入口");
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("t2_005"); pick("白名单");
ok(w.ENGINE.state.node === "end_E13", "真相线E13(白名单)可达");
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("t2_005"); pick("公之于众"); runTo("end_E14");
ok(w.ENGINE.state.node === "end_E14", "真相线E14(大白于天下)可达");
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("t2_005"); pick("留下来");
ok(w.ENGINE.state.node === "end_E15", "真相线E15(第一批疫苗)可达");

// —— 堕落线:D09/E16/E17 ——
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("f2_002"); pick("下不去手");
ok(w.ENGINE.state.node === "die_D09", "堕落线D09(投名状)可达");
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("f2_005"); pick("盯上钢牙那把椅子");
ok(w.ENGINE.state.node === "end_E16", "堕落线E16(钢牙之王)可达");
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("f2_005"); pick("反了他");
ok(w.ENGINE.state.node === "end_E17", "堕落线E17(回头是岸)可达");

// —— 安置区:入口 + E18/D08 ——
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("ch1_026");
ok([...w.document.querySelectorAll("#choices .choice")].some(b => b.textContent.includes("安置点")), "分岔口有安置区(服从)入口");
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("c3_006"); pick("告密"); runTo("end_E18");
ok(w.ENGINE.state.node === "end_E18", "安置区E18(回到工位)可达");
w.ENGINE.state = w.CORE.newState(); w.ENGINE.goto("c3_010"); pick("中心广场");
ok(w.ENGINE.state.node === "die_D08", "安置区D08(哗变之夜)可达");

// 28结局全部可达性:逐一确认每个 end_/die_ 节点存在
["E01","E02","E03","E04","E05","E06","E07","E08","E09","E10","E11","E12","E13","E14","E15","E16","E17","E18"]
  .forEach(e => ok(!!w.STORY.nodes["end_" + e] && w.STORY.nodes["end_" + e].ending === e, "结局节点存在:" + e));
["D01","D02","D03","D04","D05","D06","D07","D08","D09","D10"]
  .forEach(d => ok(!!w.STORY.nodes["die_" + d] && w.STORY.nodes["die_" + d].ending === d, "死亡节点存在:" + d));

// 结局图鉴:28格、解锁态、详情
w.GALLERY.open();
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
