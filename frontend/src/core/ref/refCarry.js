// 参照带回映射(ref.map/refMap 契约):从引用面板选中一条源数据后,把映射字段整串回填到目标对象。
// 表头弹窗确认、表头下拉选中(≤20 下拉模式)、明细行导入三条路径共用,保证带回口径一致:
// 主字段自身跳过(其值取自 refField);源行缺 from 值不覆盖;清空/自由输入由调用方不调用本函数兜底。

/** 按 ref.map/refMap 把源行字段回填到 target(to 缺省取 from,跳过 mainKey 自身)。 */
export function applyRefCarry(target, row, ref, mainKey) {
  for (const m of (ref?.map || ref?.refMap || [])) {
    if (!m || row[m.from] === undefined) continue
    const to = m.to || m.from
    if (to !== mainKey) target[to] = row[m.from]
  }
}

/** 取字段的参照配置(兼容 meta.ref 对象与列表配置顶层 refPanel/refField 两种形态)。 */
export function refConfigOf(field) {
  return field?.ref && typeof field.ref === 'object' ? field.ref : field
}

/** 编码型参照(refField≠displayField,如 供应商编码 存编码、列表按名称挑选):
 *  下拉选中态应显示存值(编码)而非选项 label(名称)——对齐弹窗模式的原始值显示,
 *  否则"编码"字段选中/被带回后显示成名称(采购入库单.供应商编码 应显示 GYS001 而非供应商名)。 */
export function refShowsCode(field) {
  const ref = refConfigOf(field)
  const f = ref?.field || ref?.refField
  const d = ref?.display || ref?.displayField
  return !!f && !!d && f !== d
}
