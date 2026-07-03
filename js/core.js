/* 《末班地铁》纯逻辑层:环境无关,浏览器与 Node 通用 */
(function (g) {
  const AFF_NPCS = ["akai", "cheng", "zhou", "xule", "xiaoman", "qin"];
  const ITEM_NAMES = { fireAxe: "消防斧", keycard: "员工门禁卡", kunlunCard: "昆仑门禁卡",
    antibiotics: "抗生素", carKey: "车钥匙", note_cheng: "程霜的字条", radio: "收音机" };
  const NPC_NAMES = { akai: "阿凯", cheng: "程霜", zhou: "老周", xule: "许乐", xiaoman: "小满", qin: "秦鹭" };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function newState() {
    return { node: "ch0_001", hp: 60, san: 70, humanity: 0,
      aff: { akai: 0, cheng: 0, zhou: 0, xule: 0, xiaoman: 0, qin: 0 },
      items: [], flags: [], day: 0, visited: [], chaptersReached: ["ch0"] };
  }

  function itemName(id) { return ITEM_NAMES[id] || id; }
  function npcName(id) { return NPC_NAMES[id] || id; }

  function checkRequire(req, state) {
    const missing = [];
    if (!req) return { ok: true, missing };
    if (req.item && !state.items.includes(req.item)) missing.push("需要:" + itemName(req.item));
    if (req.noItem && state.items.includes(req.noItem)) missing.push("不能持有:" + itemName(req.noItem));
    if (req.flag && !state.flags.includes(req.flag)) missing.push("缺少前置事件");
    if (req.noFlag && state.flags.includes(req.noFlag)) missing.push("已错过时机");
    if (req.hpAbove !== undefined && !(state.hp > req.hpAbove)) missing.push("体魄不足");
    if (req.hpBelow !== undefined && !(state.hp < req.hpBelow)) missing.push("体魄过高");
    if (req.sanAbove !== undefined && !(state.san > req.sanAbove)) missing.push("理智不足");
    if (req.sanBelow !== undefined && !(state.san < req.sanBelow)) missing.push("理智过高");
    if (req.humanityAbove !== undefined && !(state.humanity > req.humanityAbove)) missing.push("人性不足");
    if (req.humanityBelow !== undefined && !(state.humanity < req.humanityBelow)) missing.push("人性过高");
    if (req.aff && !((state.aff[req.aff.npc] || 0) >= req.aff.gte))
      missing.push(npcName(req.aff.npc) + "好感不足");
    return { ok: missing.length === 0, missing };
  }

  function applyEffects(effects, state) {
    const changes = [];
    if (!effects) return changes;
    for (const key of Object.keys(effects)) {
      const v = effects[key];
      if (key === "hp" || key === "san") {
        if (v) { state[key] = clamp(state[key] + v, 0, 100); changes.push({ k: key, delta: v }); }
      } else if (key === "humanity") {
        if (v) { state.humanity = clamp(state.humanity + v, -100, 100); changes.push({ k: key, delta: v }); }
      } else if (key === "day") { state.day = v;
      } else if (key === "item") {
        const list = Array.isArray(v) ? v : [v];
        for (const it of list) {
          if (it[0] === "-") { const i = state.items.indexOf(it.slice(1)); if (i >= 0) state.items.splice(i, 1); }
          else { const id = it[0] === "+" ? it.slice(1) : it; if (!state.items.includes(id)) state.items.push(id); }
        }
      } else if (key === "flag") {
        const list = Array.isArray(v) ? v : [v];
        for (const fl of list) if (!state.flags.includes(fl)) state.flags.push(fl);
      } else if (key.indexOf("aff_") === 0) {
        const npc = key.slice(4);
        if (AFF_NPCS.includes(npc) && v) {
          state.aff[npc] = clamp((state.aff[npc] || 0) + v, 0, 10);
          changes.push({ k: key, delta: v });
        }
      }
    }
    return changes;
  }

  g.CORE = { newState, checkRequire, applyEffects, clamp, itemName, npcName, AFF_NPCS };
})(typeof window !== "undefined" ? window : globalThis);
