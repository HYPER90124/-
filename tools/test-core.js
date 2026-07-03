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
eq(C.checkRequire({ item: "carKey" }, s).missing, ["需要:车钥匙"], "missing描述");

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
