/**
 * barcodeLabel.js — 条码管理三面板(BARCODE_MAT / BARCODE_WIP / BARCODE_FIN)的标签映射(纯函数)
 *
 * 为什么单独一个模块:三个面板列名不同(材料=存货名称/数量;半成品=产品名称/报工数量;成品=产品名称/实收数量),
 * 而标签对话框(QrLabelDialog)只认 {code,name,lot,qty,unit,doc}。这里做一次"面板列 → 标签字段"的
 * 纯映射,既让三个面板共用同一个打印入口,又能用单测钉住每一列取的是哪个键
 * —— 这类"改过字段名后取到 undefined ⇒ 标签整张空白"的坑本项目踩过(见 recordSheetConfigs 的 key 测试)。
 */

/** 三面板编码(与后端 BarcodeLabelService.PANELS / yj_panel 一一对应) */
export const BARCODE_PANELS = ['BARCODE_MAT', 'BARCODE_WIP', 'BARCODE_FIN']

/** 码名称列 / 数量列 / 单据号列 / 日期列(按面板区分;缺省回落空串,不抛错) */
const COLS = {
  BARCODE_MAT: { name: '存货名称', qty: '数量', doc: '单据编号', date: '单据日期' },
  BARCODE_WIP: { name: '产品名称', qty: '报工数量', doc: '报工单号', date: '生产日期' },
  BARCODE_FIN: { name: '产品名称', qty: '实收数量', doc: '单据编号', date: '单据日期' },
}

const s = (v) => (v == null ? '' : String(v).trim())

/**
 * 一行 → 一张标签。码内容即二维码文本(一批一码),空码返回 null(前端据此禁打)。
 * @param {string} panelCode BARCODE_MAT / BARCODE_WIP / BARCODE_FIN
 * @param {object} row 列表行(数据键=yj_field.label,中文)
 * @returns {{code:string, qrText:string, name:string, lot:string, qty:(string|number), unit:string, doc:string}|null}
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
  }
}

/** 多行 → 多张标签(空码行丢弃,保持原顺序) */
export function barcodeLabelsOf(panelCode, rows) {
  return (rows || []).map((r) => barcodeLabelOf(panelCode, r)).filter(Boolean)
}
