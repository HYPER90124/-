/* 结局元数据与通用死亡节点(28结局元数据在 Task7 补全) */
(function (g) {
  g.STORY.registerEndings({
    D10: { name: "都是同事", hint: "当理智归零。", type: "death" }
  });
  g.STORY.register("die", {
    "die_hp": { text: "你的身体先于意志放弃了。\n\n你靠着墙滑坐下去,像每一个加完班的深夜那样闭上眼。\n这一次,没有闹钟会再叫醒你。" },
    "die_D10": { text: "你笑了起来。\n\n他们摇摇晃晃地朝你走来,西装,工牌,拖着脚。\n都是同事啊,你想,原来大家都没下班。\n你张开手臂,走进了早高峰的人流里。", ending: "D10" }
  });
})(typeof window !== "undefined" ? window : globalThis);
