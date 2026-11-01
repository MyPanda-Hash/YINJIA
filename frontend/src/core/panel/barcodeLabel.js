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
 *
 * 二维码文本(2026-10-21 材料仓改版):**材料仓 = 公司代码@存货编码@批号**,批号空则两段;
 *   半成品/成品**不动** —— 仍是「码内容」(编码|批号)。见 barcodeQrText 的说明。
 */
import { COMPANY_CODE } from './companyCode.js'

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
 * 二维码文本(2026-10-21 用户口径:**材料仓 = 公司代码+@+物料编码**,并保留批号段)。
 *
 * - 材料仓:`公司代码@存货编码@批号`(如 `0@Y-S-Z@20261021004`;批号空 → `0@Y-S-Z` 两段)。
 *   公司代码取全系统常量(旧系统 plang.comm = '0');行上若真带「公司代码」列则优先用它
 *   (将来多公司/视图补列时不用改这里)。
 * - 半成品/成品:维持 `码内容`(编码|批号) 不变 —— 用户 2026-10-21 只要求改材料仓。
 * - 「码内容」列本身**不动**:它是勾选行键(qrLabelKey)、打印留痕键,也是历史标签的扫码解析口径;
 *   故这里只改二维码文本,卡面仍显示 码内容。
 *
 * @param {string} panelCode BARCODE_MAT / BARCODE_WIP / BARCODE_FIN
 * @param {object} row 列表行(数据键=中文列名)
 * @param {string} [code] 码内容(兜底:取不到存货编码时仍让标签有码可扫,不变空白)
 */
export function barcodeQrText(panelCode, row, code = '') {
  if (panelCode !== 'BARCODE_MAT') return s(code)
  const material = s(row?.['存货编码'])
  if (!material) return s(code)
  return [s(row?.['公司代码']) || COMPANY_CODE, material, s(row?.['批号'])].filter(Boolean).join('@')
}

/**
 * 一行 → 一张标签。空码(码内容为空)返回 null(前端据此禁打)。
 * 二维码文本另走 barcodeQrText:材料仓是 公司代码@存货编码@批号,半成品/成品=码内容。
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
    qrText: barcodeQrText(panelCode, row, code),
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
