(function (g) {
  g.STORY = {
    nodes: {}, nodeChapter: {}, chapters: {}, endings: {},
    register(chapterId, nodesObj) {
      for (const id of Object.keys(nodesObj)) {
        if (this.nodes[id]) throw new Error("节点ID重复: " + id);
        this.nodes[id] = nodesObj[id];
        this.nodeChapter[id] = chapterId;
      }
    },
    registerChapter(chapterId, meta) { this.chapters[chapterId] = meta; },
    registerEndings(metaObj) { Object.assign(this.endings, metaObj); }
  };
})(typeof window !== "undefined" ? window : globalThis);
