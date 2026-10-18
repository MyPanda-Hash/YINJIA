/**
 * barcodeLabel.js — 条码管理三面板(BARCODE_MAT / BARCODE_WIP / BARCODE_FIN)的标签映射(纯函数)
 *
 * 为什么单独一个模块:三个面板列名不同(材料=存货名称/数量;半成品=产品名称/报工数量;成品=产品名称/实收数量),
 * 而标签对话框(QrLabelDialog)只认固定字段。这里做一次"面板列 → 标签字段"的纯映射,
 * 既让三个面板共用同一个打印入口,又能用单测钉住每一列取的是哪个键
 * —— 这类"改过字段名后取到 undefined ⇒ 标签整张空白"的坑本项目踩过(见 recordSheetConfigs 的 key 测试)。
 *
 * 仓库/供应商/仓位(2026-10-18 用户口径「有就显示,没有就不显示」):
 *   材料:供应商(bd_purchase_in.供应商)、仓库(映射后的 MES 仓名)、仓位(行上仓位,实测全空 ⇒ 不出)
 *   成品:只有仓库名(金蝶仓名);半成品:三者皆无(报工派生,没仓库概念)
 *   ⇒ 映射不到就给空串,标签模板据此不渲染该行。
 */

/** 三面板编码(与后端 BarcodeLabelService.PANELS / yj_panel 一一对应) */
export const BARCODE_PANELS = ['BARCODE_MAT', 'BARCODE_WIP', 'BARCODE_FIN']

/** 码名称列 / 数量列 / 单据号列 / 日期列 / 仓库列 / 供应商列 / 仓位列(按面板区分;取不到一律空串) */
const COLS = {
  BARCODE_MAT: { name: '存货名称', qty: '数量', doc: '单据编号', date: '单据日期', wh: '仓库映射', supplier: '供应商', bin: '仓位' },
  BARCODE_WIP: { name: '产品名称', qty: '报工数量', doc: '报工单号', date: '生产日期', wh: '', supplier: '', bin: '' },
  BARCODE_FIN: { name: '产品名称', qty: '实收数量', doc: '单据编号', date: '单据日期', wh: '仓库名称', supplier: '', bin: '' },
}

const s = (v) => (v == null ? '' : String(v).trim())

/**
 * 一行 → 一张标签。码内容即二维码文本(一批一码),空码返回 null(前端据此禁打)。
 * warehouse / supplier / bin 为空串 = 该行没有这项数据(标签上不显示),不是缺字段。
 * @param {string} panelCode BARCODE_MAT / BARCODE_WIP / BARCODE_FIN
 * @param {object} row 列表行(数据键=yj_field.label,中文)
 */
export function barcodeLabelOf(panelCode, row) {
  const c = COLS[panelCode]
  if (!c || !row) return null
  const code = s(row['码内容'])
  if (!code) return null
  const name = [s(row[c.name]), s(row['规格型号'])].filter(Boolean).join(' ')
  const doc = [s(row[c.doc]), s(row[c.date])].filter(Boolean).join(' ')
  return {
    code,
    qrText: code,
    name,
    lot: s(row['批号']),
    qty: row[c.qty] ?? '',
    unit: s(row['计量单位']),
    doc,
    warehouse: s(c.wh ? row[c.wh] : ''),
    supplier: s(c.supplier ? row[c.supplier] : ''),
    bin: s(c.bin ? row[c.bin] : ''),
  }
}

/** 多行 → 多张标签(空码行丢弃,保持原顺序) */
export function barcodeLabelsOf(panelCode, rows) {
  return (rows || []).map((r) => barcodeLabelOf(panelCode, r)).filter(Boolean)
}
