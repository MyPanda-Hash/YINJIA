/**
 * refColumns.js — 参照弹窗「显示哪几列、按什么顺序」的唯一判据(纯函数,单测钉边界)。
 *
 * 【为什么必须单独一份】参照弹窗的数据来自 `queryFormDataList`,返回的是**单据头行**
 * (产品编号/产品名称/单据日期…);而 `panelPageDto.tablePages[0].gridTabs[0].columns`
 * 按后端 PanelConfigService 的定义是**明细列**(`fieldsAt("detail")`)。
 * 二者不同源 —— 直接拿明细列去渲染表头行,每一格都取不到值,弹窗就是一片空白。
 *
 * 【真实事故(2026-10-30)】研发「产品文件」各面板点产品编号弹参照:
 * 产品信息表 2026-10-29 新增了 BOM 明细列(序号/物料编号/物料名称/尺寸规格/数量),
 * 于是 gridTabs[0].columns 变成这 5 个明细列;弹窗里只剩前端自己造的「开发状态」有值,
 * 其余全空。用户原话:「产品文件里面的面板点击选择框的弹窗都没有显示信息」。
 *
 * 【取值优先级】
 *   ① 字段自带的 refColumns —— 调用方显式指定,尊重它;
 *   ② `dataSchema.fields` 的 dataName = **表头字段**,与弹窗行数据同源(单据面板走这条);
 *   ③ 网格列 gridTabs[0].columns —— 档案/平表面板**没有表头字段**(全部字段直接作为网格列),
 *      只有这时才退回它;
 *   ④ refField / displayField 兜底,至少能看见值。
 *
 * 【两个体验约束】(单据面板表头动辄 20~30 列,弹窗只有 880px 宽)
 *   · `hidden: true` 的字段不显示 —— 字段管理里都藏起来了,不该在参照里冒出来;
 *   · `refField` / `displayField` 提到最前 —— 选一行时最需要的是「编号 + 名称」,
 *     不能压在横向滚动的最深处。
 */

/** 从表头字段规格里取列名:元素可能是字符串,也可能是 { dataName } */
function labelOf(f) {
  if (typeof f === 'string') return f.trim()
  if (f && typeof f === 'object') {
    const v = f.dataName ?? f.label
    return typeof v === 'string' ? v.trim() : ''
  }
  return ''
}

/** 表头字段规格里是否标记为隐藏 */
function isHidden(f) {
  return !!f && typeof f === 'object' && f.hidden === true
}

/** 去空、去重,保持原顺序 */
function tidy(list, { skipHidden = false } = {}) {
  const out = []
  const seen = new Set()
  for (const raw of list || []) {
    if (skipHidden && isHidden(raw)) continue
    const s = labelOf(raw)
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/** 把 keyCols 提到最前(只保留确实存在于 cols 里的) */
function promote(cols, keyCols) {
  const keys = keyCols.filter((k) => k && cols.includes(k))
  if (!keys.length) return cols
  const rest = cols.filter((c) => !keys.includes(c))
  return [...keys, ...rest]
}

/**
 * 挑出参照弹窗要显示的列。
 *
 * @param {object} cfg  getPanelConfig(引用面板) 的返回(可能为 null/undefined)
 * @param {object} ref  归一化后的参照定义 { refColumns?, refField?, displayField? }
 * @returns {string[]}  列名数组(与弹窗行对象的键同名)
 */
export function pickRefColumns(cfg, ref) {
  const explicit = tidy(ref?.refColumns)
  if (explicit.length) return explicit

  // 与弹窗行数据同源:表头字段(排除 hidden)
  const head = tidy(cfg?.dataSchema?.fields, { skipHidden: true })
  if (head.length) return promote(head, [ref?.refField, ref?.displayField])

  // 档案/平表:没有表头字段,网格列就是全部字段
  const grid = tidy(cfg?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns)
  if (grid.length) return promote(grid, [ref?.refField, ref?.displayField])

  return tidy([ref?.refField, ref?.displayField])
}
