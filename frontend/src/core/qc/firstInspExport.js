/**
 * firstInspExport.js — 首件检验单(QC_FIRST_INSP)纸张表 → Excel(.xlsx)的**版式单一真源**。
 *
 * 用户 2026-10-17 口径:「让当前的 excel 可以导出当前这个报表页面」——
 * 指的是**当前这张纸**(《炭棒成型车间首件检验记录表》),不是列表页那套"头字段键值 + 全明细"的
 * 数据导出(那条路在 PanelxList.exportSheetExcel)。与制程检验单同口径
 * (见 core/qc/qcProcInspExport.js)。
 *
 * 只放**纯函数**(产出 aoa / 列宽 / 合并区),不 import xlsx ⇒ 可用 node:test 钉死版式;
 * 组件拿到结果后自己做 `XLSX.utils.aoa_to_sheet` + `writeFile`。
 *
 * ⚠ 实测(xlsx **社区版 0.18.5**):`!cols`(列宽)与 `!merges`(合并区)**能**写进 .xlsx;
 *   单元格样式(`.s` = 加粗/底色/自动换行)与 `cellStyles:true` 都**不会**落进文件
 *   —— 导出的就是"纯值 + 列宽 + 合并"的版式,长文本要用户自己在 Excel 里开"自动换行"。
 *
 * 版式(照纸面,与 QcFirstInspSheet.vue 的渲染**同源**):
 *   大标题 → 副标题(公司/单号/状态)→ 空行
 *   → 抬头四对(产品编号/产品型号/生产日期/组别,每行 2 组「标签|值」)
 *   → 两层表头:第一级=分组(表观及脱粉/尺寸及重量/强度/浊度及压降),
 *              第二级=测试项目;左上角「测试项目 ╲ 样品序号」纵向合并两行
 *   → 标准行(来自《成型工艺清单》)
 *   → 1#..8# 八个样品行:**每组只在自己那一对样品行上有值**,其余格照纸面写 `/`
 *   → 相关要求 6 条
 *   → 表尾:检验结果 | 检验人
 */
import {
  groupsOf, isFillableCell, columnHeadText, ROW_STANDARD, ROW_SAMPLE,
} from './firstInspCols.js'

/** 纸面空白占位符(本格无需填写) */
export const BLANK = '/'
/** 一个测试项目列的 Excel 列宽(字符) */
const TEST_COL_WCH = 16
/** 行标签列的 Excel 列宽 */
const LABEL_COL_WCH = 14

/**
 * 组装导出的二维数组与合并区。
 * @param {object} p
 * @param {string} p.title    标题(炭棒成型车间首件检验记录表)
 * @param {string} p.subtitle 副标题(公司 + 单据编号 + 单据状态)
 * @param {Array<Array<{label:string,value:string}>>} p.headPairs 抬头:每行最多 2 组(与纸面同一分行口径)
 * @param {Array<object>} p.columns 测试项目列(**已按分组排好**,与纸面列序一致)
 * @param {Array<object>} p.items   明细行(长表:行类型/样品序号/检验列/标准/实测数值)
 * @param {string[]} p.requirements 纸面《相关要求》6 条(已翻译的文本)
 * @param {{resultLabel?:string,result?:string,byLabel?:string,by?:string}} p.foot 表尾
 * @returns {{aoa:Array<Array<any>>, cols:Array<{wch:number}>, merges:Array<object>, marks:object}}
 */
export function buildFirstInspExport({
  title = '炭棒成型车间首件检验记录表',
  subtitle = '',
  headPairs = [],
  columns = [],
  items = [],
  requirements = [],
  foot = {},
} = {}) {
  const text = (v) => (v === undefined || v === null ? '' : String(v))
  const colsIn = Array.isArray(columns) ? columns : []
  const N = Math.max(2, 1 + colsIn.length)          // 第一列 = 样品序号/行标签
  const aoa = []
  const merges = []
  const push = (row) => { aoa.push(row); return aoa.length - 1 }
  const mergeRow = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: N - 1 } })

  // ── 标题 + 副标题 + 空行 ──
  mergeRow(push([title]))
  mergeRow(push([subtitle]))
  push([])

  // ── 抬头:每行 2 组「标签|值」(标签占 1 列,值占 valW 列;余列并进最后一个值格) ──
  const headRows = (headPairs || []).filter(Boolean).slice(0, 4)
  for (let i = 0; i < headRows.length; i += 2) {
    const line = new Array(N).fill('')
    const grp = [headRows[i], headRows[i + 1]].filter(Boolean)
    const valW = Math.max(1, Math.floor((N - grp.length) / grp.length))
    let c = 0
    for (const g of grp) {
      line[c] = text(g.label)
      line[c + 1] = text(g.value)
      if (valW > 1) merges.push({ s: { r: aoa.length, c: c + 1 }, e: { r: aoa.length, c: c + valW } })
      c = c + valW + 1
    }
    // 余列并进最后一个值格(不越界:只在真的还剩列时才并)
    if (c > 1 && c - 1 < N - 1) merges.push({ s: { r: aoa.length, c: c - 1 }, e: { r: aoa.length, c: N - 1 } })
    push(line)
  }

  // ── 两层表头(第一级=分组,跨本组各列;第二级=测试项目) ──
  const groups = groupsOf(colsIn)
  const groupRow = aoa.length
  const itemRow = groupRow + 1
  const g1 = new Array(N).fill('')
  g1[0] = '测试项目 ╲ 样品序号'
  let gc = 1
  for (const g of groups) {
    const n = colsIn.filter((x) => x.group === g).length
    if (n <= 0) continue
    g1[gc] = text(g)
    if (n > 1) merges.push({ s: { r: groupRow, c: gc }, e: { r: groupRow, c: gc + n - 1 } })
    gc += n
  }
  push(g1)
  const g2 = new Array(N).fill('')
  colsIn.forEach((col, i) => { g2[i + 1] = columnHeadText(col) })
  push(g2)
  // 左上角「测试项目/样品序号」跨两层表头
  merges.push({ s: { r: groupRow, c: 0 }, e: { r: itemRow, c: 0 } })

  // ── 标准行 ──
  const stdRow = aoa.length
  const stdLine = new Array(N).fill('')
  stdLine[0] = '标准'
  colsIn.forEach((col, i) => { stdLine[i + 1] = text(col.standard) || BLANK })
  push(stdLine)

  // ── 1#..8# 样品行:可填范围与屏幕/纸面**同源**(isFillableCell) ──
  //    前两列(勾选式)只记 1#/2#,其余格照纸面写 `/`;其余所有列(含以后新增的列)八行全可填
  const dataStart = aoa.length
  for (const s of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const line = new Array(N).fill('')
    line[0] = `${s}#`
    colsIn.forEach((col, i) => {
      line[i + 1] = isFillableCell(s, col) ? text(measuredOf(items, s, col.key)) : BLANK
    })
    push(line)
  }
  const dataEnd = aoa.length - 1

  // ── 相关要求 ──
  push([])
  const reqTitleRow = push(['相关要求：'])
  mergeRow(reqTitleRow)
  const reqRows = []
  for (const r of requirements || []) {
    const row = push([text(r)])
    mergeRow(row)
    reqRows.push(row)
  }

  // ── 表尾:检验结果 | 检验人 ──
  push([])
  const footRow = aoa.length
  const mid = Math.max(2, Math.floor(N / 2))
  const footLine = new Array(N).fill('')
  footLine[0] = text(foot.resultLabel) || '检验结果'
  footLine[1] = text(foot.result)
  if (mid - 1 > 1) merges.push({ s: { r: footRow, c: 1 }, e: { r: footRow, c: mid - 1 } })
  footLine[mid] = text(foot.byLabel) || '检验人'
  footLine[mid + 1] = text(foot.by)
  if (N - 1 > mid + 1) merges.push({ s: { r: footRow, c: mid + 1 }, e: { r: footRow, c: N - 1 } })
  push(footLine)

  return {
    aoa,
    cols: [{ wch: LABEL_COL_WCH }, ...colsIn.map(() => ({ wch: TEST_COL_WCH }))],
    merges,
    marks: { groupRow, itemRow, stdRow, dataStart, dataEnd, reqTitleRow, reqRows, footRow, colCount: N },
  }
}

/** 取某样品 × 某列的实测值(长表里找那一行;找不到给空串) */
function measuredOf(items, sample, key) {
  const want = `${sample}#`
  const row = (items || []).find((r) => r
    && String(r['行类型']) === ROW_SAMPLE
    && String(r['样品序号']) === want
    && String(r['检验列'] || r['检验项目'] || '') === String(key))
  return row ? row['实测数值'] : ''
}
