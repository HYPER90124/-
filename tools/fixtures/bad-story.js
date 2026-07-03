(function (g) {
  g.STORY.register("ch0", {
    "ch0_001": { text: "测试节点。", choices: [
      { text: "去一个不存在的地方", color: "red", goto: "ch0_999" },
      { text: "非法条件", color: "pink", require: { itemz: "x" }, goto: "ch0_002" }
    ]},
    "ch0_002": { text: "结局节点。", ending: "E99" },
    "bad_id_1": { text: "坏ID。" }
  });
})(typeof window !== "undefined" ? window : globalThis);
