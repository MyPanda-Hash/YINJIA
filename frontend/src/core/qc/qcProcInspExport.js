/**
 * qcProcInspExport.js — 制程检验单(QC_PROC_INSP)纸张表 → Excel(.xlsx)的**版式单一真源**。
 *
 * 用户 2026-10-17 口径:「同时实现当前可excel导出」—— 指的是**当前这张纸**(制程检验记录表),
 * 不是列表页那套"头字段键值 + 全字段明细"的数据导出(那条路在 PanelxList.exportSheetExcel)。
 *
 * 只放**纯函数**(产出 aoa / 列宽 / 合并区),不 import xlsx ⇒ 可用 node:test 钉死版式;
 * 组件拿到结果后自己做 `XLSX.utils.aoa_to_sheet` + `writeFile`(与 QcCatalogSheet 同一套写法)。
 *
 * ⚠ 实测(xlsx **社区版 0.18.5**,`tools/archive/_probe-xlsx-cols.mjs`):
 *     · `!cols`(列宽)与 `!merges`(合并区)**能**写进 .xlsx(解压看 xl/worksheets/sheet1.xml 里的 `<cols>`);
 *     · 单元格样式(`.s` = 加粗/底色/自动换行)与 `cellStyles:true` 选项都**不会**落进文件
 *       —— 导出的就是"纯值 + 列宽 + 合并"的版式,长文本在 Excel 里要用户自己开"自动换行"才好看。
 *       要带框线/自动换行的纸面级 Excel,得换 `xlsx-js-style` 或走后端报表(另开任务,别在这里硬凑)。
 *
 * 版式(照纸面):
 *   标题(合并全宽)→ 副标题(公司/单号/状态)→ 空行
 *   → 抬头若干行:每行 2 组「标签|值」(标签 1 列、值 3 列)
 *   → 表头 2 行:客户名称|产品编码|型号（mm）|批号|检验人员：<值>(跨 检验要求+检验方法)|产线常规功能性结果|结果判断
 *                以下检验要求/检验方法自动填充出货检验计划表
 *   → 数据行:一行一个检验项目(左侧四列的**列名**合并表头两行、**取值**合并整个表体)
 *   → 结论区:检验结论 / 处理意见 / 检验人+审核人
 */

/** 纸面列(顺序即 Excel 列序;`head` = 该列取的头字段键,缺省与 label 同名) */
export const PROC_INSP_COLS = [
  { label: '客户名称', wch: 16 },
  { label: '产品编码', wch: 16 },
  { label: '型号（mm）', wch: 14, head: '规格型号' },
  { label: '批号', wch: 14, head: '批次号' },
  { label: '检验要求', wch: 34 },
  { label: '检验方法', wch: 46 },
  { label: '产线常规功能性结果', wch: 18 },
  { label: '结果判断', wch: 12 },
]
/** 结论区三行的标签(照纸面) */
export const PROC_INSP_FOOT = [
  { label: '检验结论', key: '总结论', big: true },
  { label: '处理意见', key: '处理方式', big: true },
  { label: '检验人', key: '检验员', secondLabel: '审核人', secondKey: '审核人' },
]

/**
 * 组装导出的二维数组与合并区。
 * @param {object} p
 * @param {string} p.title 标题(制程检验记录表)
 * @param {string} p.subtitle 副标题(公司名 + 单据编号 + 单据状态)
 * @param {Array<Array<{label:string,value:string}>>} p.headPairs 抬头:每行 2 组(与纸面同一分行口径)
 * @param {object} p.head 单据头(取左侧四列 + 检验员 + 结论区)
 * @param {Array<object>} p.rows 明细行(一行一个检验项目)
 * @returns {{aoa:Array<Array<any>>, cols:Array<{wch:number}>, merges:Array<object>, headerRow1:number, headerRow2:number}}
 */
export function buildProcInspExport({ title = '制程检验记录表', subtitle = '', headPairs = [], head = {}, rows = [] } = {}) {
  const N = PROC_INSP_COLS.length
  const aoa = []
  const merges = []
  const text = (v) => (v === undefined || v === null ? '' : String(v))

  // ── 标题 + 副标题 + 空行 ──
  aoa.push([title])
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: N - 1 } })
  aoa.push([subtitle])
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: N - 1 } })
  aoa.push([])

  // ── 抬头:每行 2 组「标签|值」,标签 1 列、值 3 列 ──
  for (const pair of headPairs || []) {
    const line = []
    const groups = (pair || []).slice(0, 2)
    for (let gi = 0; gi < 2; gi++) {
      const g = groups[gi] || {}
      line.push(text(g.label))
      line.push(text(g.value))
      line.push('')
      line.push('')
    }
    const r = aoa.length
    aoa.push(line)
    merges.push({ s: { r, c: 0 }, e: { r, c: 0 } })          // 标签格(占 1 列;显式登记便于居中样式)
    merges.push({ s: { r, c: 1 }, e: { r, c: 3 } })          // 值格(跨 3 列)
    if (groups.length > 1) {
      merges.push({ s: { r, c: 4 }, e: { r, c: 4 } })
      merges.push({ s: { r, c: 5 }, e: { r, c: 7 } })
    }
  }
  aoa.push([])

  // ── 表头 2 行 ──
  const headerRow1 = aoa.length
  aoa.push([
    PROC_INSP_COLS[0].label, PROC_INSP_COLS[1].label, PROC_INSP_COLS[2].label, PROC_INSP_COLS[3].label,
    `检验人员：${text(head['检验员'])}`, '',
    PROC_INSP_COLS[6].label, PROC_INSP_COLS[7].label,
  ])
  merges.push({ s: { r: headerRow1, c: 4 }, e: { r: headerRow1, c: 5 } })
  const headerRow2 = aoa.length
  aoa.push(['', '', '', '', '以下检验要求自动填充出货检验计划表', '以下检验方法自动填充出货检验计划表', '', ''])
  // 左侧四列(单据级)分**两段**合并,与纸面同形(纸面 = 列头 rowspan=2 的 th + 表体 rowspan=行数 的 td):
  //   ① 表头两行 → 列名(客户名称/产品编码/型号（mm）/批号);
  //   ② 表体首行到末行 → **取值**(客户名称/产品编码/规格型号/批次号)。
  // ⚠ 2026-10-17 修:先前只合并了 ①表头～末行 **一段**、值没写进去 ⇒ 导出的 Excel 左四列只有列名、
  //   四个单据级值(客户/产品/型号/批号)全丢;`leftColValue` 也因此成了没人调的摆设(只有单测在调)。
  const firstData = headerRow2 + 1
  const lastData = Math.max(firstData, headerRow2 + rows.length)
  for (let c = 0; c < 4; c++) {
    merges.push({ s: { r: headerRow1, c }, e: { r: headerRow2, c } })
    merges.push({ s: { r: firstData, c }, e: { r: lastData, c } })
  }

  // ── 数据行(一行一个检验项目;左侧四列取值只在首行,其余行被合并盖住故留空) ──
  const dataRows = rows.length ? rows : [null]
  dataRows.forEach((row, ri) => {
    aoa.push([
      ...(ri === 0 ? PROC_INSP_COLS.slice(0, 4).map((c) => leftColValue(c, head)) : ['', '', '', '']),
      text(row?.['检验要求']),
      text(row?.['检验方法']),
      text(row?.['产线常规功能性结果']),
      text(row?.['结果判断']),
    ])
  })
  aoa.push([])

  // ── 结论区 ──
  for (const f of PROC_INSP_FOOT) {
    const r = aoa.length
    if (f.secondLabel) {
      aoa.push([f.label, text(head[f.key]), '', '', f.secondLabel, text(head[f.secondKey]), '', ''])
      merges.push({ s: { r, c: 1 }, e: { r, c: 3 } })
      merges.push({ s: { r, c: 5 }, e: { r, c: 7 } })
    } else {
      aoa.push([f.label, text(head[f.key]), '', '', '', '', '', ''])
      merges.push({ s: { r, c: 1 }, e: { r, c: N - 1 } })
    }
  }

  return {
    aoa,
    cols: PROC_INSP_COLS.map((c) => ({ wch: c.wch })),
    merges,
    headerRow1,
    headerRow2,
  }
}

/** 左侧四列的取值键(与纸面一致:型号→规格型号、批号→批次号) */
export function leftColValue(col, head = {}) {
  return String(head[col.head || col.label] ?? '')
}
