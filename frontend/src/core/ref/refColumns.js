/**
 * refColumns.js — 参照弹窗「显示哪几列、按什么顺序」的唯一判据(纯函数,单测钉边界)。
 *
 * 【为什么必须单独一份】参照弹窗的数据来自 `queryFormDataList`;而列有两份候选、且与行数据
 * **同源才不空白**:
 *   · `dataSchema.fields` = 单据面板的**表头字段**(单据头行走这条);
 *   · `panelPageDto.tablePages[0].gridTabs[0].columns` = 后端 PanelConfigService 的**明细列**
 *     (`fieldsAt("detail")`;单单据/档案面板的行就是展平后的明细行,走这条)。
 *
 * 【真实事故(2026-10-30)】研发「产品文件」各面板点产品编号弹参照:
 * 产品信息表 2026-10-29 新增了 BOM 明细列(序号/物料编号/物料名称/尺寸规格/数量),
 * 于是 gridTabs[0].columns 变成这 5 个明细列;弹窗里只剩前端自己造的「开发状态」有值,
 * 其余全空。用户原话:「产品文件里面的面板点击选择框的弹窗都没有显示信息」。
 *
 * 【真实事故(2026-11-01)】上面那次把「优先 dataSchema.fields」写成了**无条件**,
 * 但基础档案(archive)面板的 dataSchema 按规范 §八 恒为占位 `[{dataName:'备注'}]`
 * (业务字段全在 detail 页签,见 PanelConfigService.buildArchiveConfig 第 220 行),
 * 参照行又是 detail 展平行 ⇒ 所有指向档案面板的参照弹窗只剩一列「备注」且全空。
 * 用户原话:「当前工序报工单的选择为什么会这样,只有备注列」
 * (工序报工单 → 工序字段 → 参照面板「工序」OP)。判据因此按 `metadata.singleDoc` 分流:
 * 单单据面板的行是展平明细行 ⇒ 必须取网格列,只有普通单据面板才取表头字段。
 *
 * 【取值优先级】
 *   ① 字段自带的 refColumns —— 调用方显式指定,尊重它;
 *   ② **普通单据面板**取 `dataSchema.fields`(表头字段,与单据头行同源);
 *   ③ 网格列 gridTabs[0].columns —— **单单据/档案面板**(`metadata.singleDoc===true`:行是
 *      `detail.tabs[0]` 展平行,dataSchema 对档案只是占位「备注」)与平表面板都走这条;
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

  // 单单据面板(基础档案 archive / 项目进度查询等):参照弹窗的行是 `detail.tabs[0]` 的
  // **展平明细行**(engine.queryRefRows 的 singleDoc 分支),dataSchema 对档案更是规范的
  // 占位「备注」—— 拿它当列 ⇒ 只剩一列「备注」全空(2026-11-01 工序参照报障)。
  const singleDoc = cfg?.metadata?.singleDoc === true
  if (!singleDoc) {
    // 与弹窗行数据同源:表头字段(排除 hidden)
    const head = tidy(cfg?.dataSchema?.fields, { skipHidden: true })
    if (head.length) return promote(head, [ref?.refField, ref?.displayField])
  }

  // 单单据/档案/平表:行是明细行,网格列就是全部字段
  const grid = tidy(cfg?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns)
  if (grid.length) return promote(grid, [ref?.refField, ref?.displayField])

  return tidy([ref?.refField, ref?.displayField])
}
