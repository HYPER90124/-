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
  if (node.goto && !S.nodes[node.goto]) errors.push(`悬空goto: ${id} -> ${node.goto}`);
  for (const c of node.choices || []) {
    countCjk(c.text || "");
    if (!COLORS.includes(c.color || "white")) errors.push(`非法颜色: ${id} -> ${c.color}`);
    if (!c.goto || !S.nodes[c.goto]) errors.push(`悬空goto: ${id} -> ${c.goto}`);
    for (const k of Object.keys(c.require || {})) if (!REQ_KEYS.includes(k)) errors.push(`非法require键: ${id} -> ${k}`);
    if (c.require && c.require.aff && !globalThis.CORE.AFF_NPCS.includes(c.require.aff.npc))
      errors.push(`非法require键: ${id} -> aff.${c.require.aff.npc}`);
  }
  if (!node.ending && (!node.choices || node.choices.length === 0) && !node.goto && !node.endOfContent)
    errors.push(`死胡同节点(无choices/goto/ending): ${id}`);
}
console.log(`节点数: ${Object.keys(S.nodes).length}  正文+选项字数(CJK): ${cjk}`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("校验通过");
