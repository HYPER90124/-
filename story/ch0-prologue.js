/* 序章·写字楼(临时冒烟版,Task8/9 替换为正式剧情) */
(function (g) {
  g.STORY.registerChapter("ch0", { title: "序章·写字楼", start: "ch0_001" });
  g.STORY.register("ch0", {
    "ch0_001": {
      text: "凌晨1:40,深圳,南山科技园。\n你趴在22层的工位上,屏幕里的报错还没改完。\n茶水间传来一声{red:闷响}。",
      choices: [
        { text: "过去看看", color: "blue", effects: { flag: "clue_lab" }, goto: "ch0_002" },
        { text: "戴上耳机,继续改bug", color: "green", effects: { san: -5 }, goto: "ch0_002" },
        { text: "对着茶水间大喊", color: "red", effects: { san: -60 }, goto: "ch0_002" }
      ]
    },
    "ch0_002": {
      text: "灯灭了一半。\n你意识到,今晚不太对劲。拿上{item:员工门禁卡},你朝安全通道走去。",
      effects: { item: "+keycard" },
      goto: "ch0_003"
    },
    "ch0_003": {
      text: "安全通道的门虚掩着,门后一片漆黑。",
      endOfContent: true
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
