# CLAUDE.md — 《末班地铁》开发规范(每次会话必读)

这是一个**丧尸末日文字冒险游戏**,手机浏览器可玩,自研 JS 引擎 + 分文件剧情数据。
**在续写任何剧情前,先读这份文件,再读 `docs/superpowers/specs/2026-07-04-zombie-text-game-design.md`(权威设计文档:世界观/人物/六线大纲/28结局全表都在里面)。**

## 当前进度(2026-07-04)
- 故事主体**已完结**:六条主线 + 服从终幕全部打通,**28 个结局(E01–E18 + D01–D10)全部实装可达**。
- 累计约 **7.4 万字 / 228 节点**。长期目标 50 万字,后续方向是**加厚**(支线、群像、日常细节),而非改结构。
- 已部署 GitHub Pages:https://hyper90124.github.io/-/ (每次 push 自动更新)。

## 铁律:不要破坏已有内容
1. **不要重命名或删除任何已存在的节点** —— 别的节点可能 `goto` 它。要改,先全局搜索引用。
2. **加厚 = 在现有节点之间插入新节点,或丰富现有节点的 text**;不要改动已定稿的结局走向和触发条件。
3. **新章节文件必须在 `js/story-index.js` 里登记**,否则不会被加载。
4. 每次改完**必须跑校验和测试**(见下),全绿再提交。

## 节点数据格式(引擎只认这一种)
```js
g.STORY.register("章节id", {
  "ch1_012": {                       // 节点id,见下方规范
    text: "第二人称叙事……",          // 支持内联标记 {item:消防斧} {npc:老周} {red:幻觉红字}
    effects: { san:-5, hp:0, humanity:-10, day:1,
               item:"+fireAxe",        // 加物品;"-fireAxe" 减;可用数组
               flag:"clue_lab",        // 置flag;可用数组 ["a","b"]
               aff_akai:1 },           // NPC好感,键名 aff_<npc>
    choices: [
      { text:"选项文字", color:"red", // 颜色: white/red/green/blue/purple/gold
        require:{ item:"fireAxe" },    // 不满足则灰色锁定(加 hideWhenLocked:true 则隐藏)
        effects:{ san:-3 }, goto:"ch1_013" }
    ],
    goto: "ch1_013",                   // 无choices时的直连(显示"继续"按钮)
    ending: "E04",                     // 结局节点专用,登记图鉴
    endOfContent: "封锁提示文字"        // 内容尽头占位(加厚时应尽量消灭这类占位)
  }
});
```

- **require 支持的键**:`hpAbove/hpBelow`、`sanAbove/sanBelow`、`humanityAbove/humanityBelow`(严格大于/小于)、`item`、`noItem`、`flag`、`noFlag`、`aff:{npc,gte}`。**只有这些**,写别的键校验会报"非法require键"。
- **数值**:hp/san 0~100(初始60/70),humanity -100~+100(初始0,**玩家不可见**),aff_* 0~10。
- **节点ID规范(正则,写错会报"非法节点ID")**:
  `^(ch0|ch1|h2|r2|n2|s2|t2|f2|c3)_\d{3}$` 三位数字;死亡结局 `die_D01`…`die_D10`;命运结局 `end_E01`…`end_E18`;力竭兜底 `die_hp`。**不能带字母后缀**(如 `r2_020b` 非法)。
- **结局节点约定**:命运结局全文放在 `end_E0x` 节点(带 `ending:"E0x"`),死亡放 `die_D0x`(带 `ending:"D0x"`)。图鉴按此 id 查重读文本。一个结局有多条路径时,主路径终局节点用 `end_E0x`,次路径节点可自身带 `ending:"E0x"`。

## 写作规范
- 第二人称"你";主角**陈默**,25岁社畜程序员。基调:写实压抑 + 人性拷问,黑色幽默只出现在陈默内心吐槽。
- 单节点正文 **100~300 字**,重场面 ≤500 字。gold(命运抉择)每章 ≤2 个。
- 每个选择的后果要在 **3 个节点内**产生可感知差异(文本或数值)。
- 病毒名 **「鸿茅药酒」(HM-7)**;陈默是受试者 **HM-041**,有免疫暗线(flag `clue_immune`)。
- **跨线时间线一致**:Day2 全城停电夜、Day4 军方宣布梧桐山安置区、Day6 暴雨停歇(丧尸嗅觉恢复,难度上升)。丧尸趋声、雨天嗅觉失灵。

## 章节文件与入口
| 文件 | 线 | 入口 |
|---|---|---|
| story/ch0-prologue.js | 序章·写字楼 | 新游戏起点 ch0_001 |
| story/ch1-baishizhou.js | 第一幕·白石洲 + 六线分岔 | ch1_026 是五个gold抉择的枢纽 |
| story/ch2-rescue.js | 寻人线 | ch1_091→r2_001 |
| story/ch2-hold.js | 固守线 | ch1_090→h2_001(投效钢牙 h2_015→堕落线) |
| story/ch2-north.js | 撤离线 | ch1_092→n2_001 |
| story/ch2-sea.js | 海路线 | ch1_093→s2_001 |
| story/ch2-truth.js | 真相线(隐藏,需 clue_immune) | ch1_094→t2_001 |
| story/ch2-fall.js | 堕落线(隐藏) | 固守线 h2_015→f2_001 |
| story/ch3-camp.js | 终幕·梧桐山安置区 | ch1_095→c3_001 |
| story/endings.js | 全部死亡结局文本 + 结局元数据 | die_D0x |

关键 NPC:阿凯(室友骑手,aff_akai)、程霜(女友护士,aff_cheng)、老周(保安,aff_zhou)、小满(8岁女孩,aff_xiaoman)、许乐(应届生,aff_xule)、秦鹭(研究员,aff_qin)、康明远(前CEO/重建委员会)、钢牙(掠夺者头目)。

## 命令(重要:Node 不在 Git Bash 的 PATH 里)
在 **PowerShell** 里先加路径,或用绝对路径调用:
```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
node tools/validate.js   # 校验剧情(悬空goto/非法require/非法id/未登记结局)+ 统计字数
npm test                 # 全套单元测试 + jsdom端到端(首次需先 npm install)
node tools/build.js      # 打包单文件 offline.html
```
Git Bash 里 node 不可用时:`& "C:\Program Files\nodejs\node.exe" tools/validate.js`

## 标准工作流(每次加厚剧情)
1. 读本文件 + 设计文档 + 要改的 story 文件。
2. 写/插入节点(遵守上面全部规范)。
3. `node tools/validate.js` 通过(字数应增加,无报错)。
4. `npm test` 全绿(如新增了可达结局/分支,补一条 e2e 断言到 tools/test-e2e.js)。
5. `node tools/build.js` 重新打包。
6. `git add -A && git commit`(中文提交信息,结尾带 Co-Authored-By 行),`git push`。
