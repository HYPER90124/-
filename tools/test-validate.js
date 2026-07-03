// 运行: node tools/test-validate.js
const { execSync } = require("child_process");
const path = require("path");
let out = "", code = 0;
try {
  out = execSync(`"${process.execPath}" "${path.join(__dirname, "validate.js")}" "${path.join(__dirname, "fixtures/bad-story.js")}"`, { encoding: "utf8" });
} catch (e) { code = e.status; out = (e.stdout || "") + (e.stderr || ""); }
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
