/* 打包单文件 offline.html:内联全部 CSS/JS/剧情,双击即玩。
   运行: node tools/build.js */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

let html = read("index.html");

// 内联样式
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g,
  (m, href) => "<style>\n" + read(href) + "\n</style>");

// 收集脚本清单:index.html 里的 <script src> + STORY_FILES
const srcs = [];
html = html.replace(/<script src="([^"]+)"><\/script>\s*/g, (m, src) => { srcs.push(src); return ""; });

// story-index.js 提供 STORY_FILES
global.window = undefined;
require(path.join(ROOT, "js/story-index.js"));
const storyFiles = globalThis.STORY_FILES;

// 拼接顺序:引擎脚本(story-index除外,离线版不需要动态加载清单)→ 剧情文件
let bundle = "";
for (const src of srcs) {
  if (src.includes("story-index")) continue;
  bundle += "\n/* ==== " + src + " ==== */\n" + read(src);
}
// 离线版:剧情直接内联,STORY_FILES 置空让 engine.boot 跳过动态加载
bundle += "\n/* ==== inline story ==== */\nwindow.STORY_FILES = [];\n";
for (const f of storyFiles) bundle += "\n/* ==== " + f + " ==== */\n" + read(f);

html = html.replace("</body>", "<script>\n" + bundle + "\n</script>\n</body>");

const out = path.join(ROOT, "offline.html");
fs.writeFileSync(out, html);
console.log(`offline.html 已生成 (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
