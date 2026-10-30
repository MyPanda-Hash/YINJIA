/**
 * materialKindMap.js —— X烧结配方表「行种类」→ 商品档案「所属类别」  2026-10-30
 *
 * 【用户口径·原话】
 *   「把这个新加的面板的配方计算里面的，根据各自的种类做预筛选，
 *     这样子可以下拉选择对应的物料编号和物料名称，可以参考另一个的配方计算器」
 *
 * 【为什么不是一对一】
 *   X烧结的 10 行是**料位名**（粉料1..5 / 胶粉1..2 / 颗粒料1..3），
 *   而商品档案 bs_inv.所属类别 是**物料属性**（炭粉 / 胶粉 / 功能料-粉末 / 功能料-颗粒 / 折算物料…）。
 *   实测真实单据 T205 就跨了两类：
 *     粉料1 YJ-HKK-005/006「专用炭X2」  → 炭粉
 *     粉料3 BK1-D/10                    → 功能料-粉末
 *     胶粉1 YJ-ZX-004「M3-D胶粉」        → 胶粉
 *   ⇒ **粉料位必须同时允许 炭粉 与 功能料-粉末**，否则粉料3 那类功能粉料根本选不出来。
 *
 * 【与成型工艺清单那边的区别】
 *   那边（core/mold/materialKinds.js）是「物料种类格」本身可编辑、由引擎按关键词认料位；
 *   X烧结这边料位是**固定 10 行**（Excel 就这么排的），种类不可改 ——
 *   所以这里只做「这行该去哪些类别里找候选」，不做料位判定。
 *
 * 【词表与档案对齐】返回的每个词都必须是 bs_inv.所属类别 的真实取值
 *   （实测 8 类：炭粉 / 功能料-颗粒 / 包装材料 / 功能料-粉末 / 胶粉 / 折算物料 / 辅助材料 / 成品）。
 *   包装材料/辅助材料/成品 不在这里：它们进不了配方表。
 */

/** 料位前缀 → 允许的档案类别（顺序即候选拼接顺序） */
const KIND_RULES = Object.freeze([
  { prefix: '粉料', kinds: ['炭粉', '功能料-粉末'] },
  { prefix: '胶粉', kinds: ['胶粉'] },
  { prefix: '颗粒料', kinds: ['功能料-颗粒'] },
])

/**
 * @param {string} rowKind 行种类（行内显示的名字：粉料1 / 胶粉2 / 颗粒料3 …）
 * @returns {string[]} 该行该去哪些档案类别里找候选；认不出来返回 []（不预筛，退回手工输入）
 */
export function kindsOfXsinterRow(rowKind) {
  const k = String(rowKind ?? '').trim()
  if (!k) return []
  const hit = KIND_RULES.find((r) => k.startsWith(r.prefix))
  return hit ? [...hit.kinds] : []
}

/** 该行是否支持按种类预筛（认不出前缀的行按不支持处理） */
export function rowHasKindFilter(rowKind) {
  return kindsOfXsinterRow(rowKind).length > 0
}
