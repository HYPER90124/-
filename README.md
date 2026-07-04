# 末班地铁

> 丧尸末日生存 · 文字冒险游戏 | 手机浏览器即开即玩

台风"海鳗"登陆深圳的凌晨,25岁的程序员陈默还在22层加班。
当测试同事咬穿主管喉咙的那一刻,他对灾难的第一反应是:"这下不用上线了。"

- **28个结局**(18个命运大结局 + 10个叙事性死亡结局),结局图鉴收集
- **6色选项系统**:红=危险 / 绿=稳妥 / 蓝=调查 / 紫=条件解锁 / 金=命运抉择 / 灰=锁定
- **轻度数值**:体魄、理智、物品、NPC好感、隐藏人性值;低理智时文字会"发疯"
- **存档**:自动存档 + 5个手动槽 + 存档码导出/导入(换设备不丢进度)
- 打字机文字动效,深色护眼,竖屏优先,支持 `prefers-reduced-motion`

## 怎么玩

**本地**:直接双击 `index.html`(或打包后的 `offline.html`)即可,无需联网、无需安装任何东西。

**手机**:把 `offline.html` 发到手机(微信文件传输助手/网盘/数据线),用浏览器打开。

**打包单文件**:

```bash
node tools/build.js   # 生成 offline.html(全部剧情内联,约132KB起)
```

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库(如 `last-train`),把本目录推上去:
   ```bash
   git remote add origin https://github.com/<你的用户名>/last-train.git
   git push -u origin main
   ```
2. 仓库 Settings → Pages → Source 选 `main` 分支根目录,保存。
3. 一两分钟后访问 `https://<你的用户名>.github.io/last-train/`,手机输入网址即玩。

## 开发

```bash
npm install        # 仅测试需要(jsdom)
npm test           # 全部单元测试 + jsdom 端到端冒烟
npm run validate   # 剧情静态校验(悬空跳转/非法条件/结局登记)+ 字数统计
npm run build      # 打包 offline.html
```

新增剧情:在 `story/` 下建章节文件并在 `js/story-index.js` 登记;节点格式、ID规范、写作规范见 `docs/superpowers/specs/2026-07-04-zombie-text-game-design.md`(全部大纲与28结局设定都在这份文档里)。

## 路线图(文本量目标 ≥50万字,分阶段累积)

| 阶段 | 内容 | 状态 |
|---|---|---|
| P1 | 引擎 + 序章「写字楼」(约2.7万字, D01/D02/D10可解锁) | ✅ 当前版本 |
| P2 | 第一幕「雨夜穿城」+ 六条主线入口 | 计划中 |
| P3 | 固守线 + 寻人线 | 计划中 |
| P4 | 撤离线 + 海路线 | 计划中 |
| P5 | 真相线 + 堕落线 + 安置区交汇章 | 计划中 |
| P6 | 28结局全收尾 + 全线润色 | 计划中 |
