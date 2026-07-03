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
