/**
 * ledgerCols.js — 只读台账页(pages[i].ledger)的**单元格取值**纯函数。
 *
 * 台账页用例 = 测试申请单(RD_DOM_TEST)第 3 个页签「委托测试汇总表」:把本面板**全部单据**
 * 的表头摘要列成一张纸面表格(设计《测试申请单.xlsx》sheet「汇总表」:序号/表格编号/发起人/
 * 申请日期/分类/状态)。它是**派生视图**,不落库、不占字段。
 *
 * 【为什么单独一个文件】取值规则必须能在 node --test 下直接断言:
 *   · seq:true       行号(台账自己编号,不用单据里的序号)
 *   · keys:[...]     在**单据表头**上按序回退取第一个非空键 —— 面板之间单号/日期的键名并不统一
 *                    (单据编号 / 编号 / 单号;单据日期 / 日期),写死一个键就会整列空白
 *   · detailKeys:[…] 表头上取不到时退到**明细第一行**取:设计的「发起人」= 申请单上的
 *                    申请人/发起人,它在设计里是**明细列**,单据表头根本没有这一项 ——
 *                    只查表头会整列空白(2026-09-30 实机踩到:汇总表 4 行的发起人全空)
 *   · map:{...}      取值后做**显示映射**(申请单类型「内部委托」→ 分类「内部」);
 *                    未登记的取值原样显示 —— 映射表陈旧时宁可显示原值,也不要把值吞掉
 *
 * ⚠ 与 recordSheetConfigs.js 的 pages[i].ledger.cols 是同一份契约,改一处必须改另一处
 *   (recordSheetConfigs.testapply.test.js 钉住两侧一致)。
 */

/** 按序回退取第一个非空值(空白串不算命中) */
function firstNonEmpty(obj, keys) {
  if (!obj || !Array.isArray(keys)) return ''
  for (const k of keys) {
    const x = obj[k]
    if (x !== undefined && x !== null && String(x).trim() !== '') return String(x)
  }
  return ''
}

/**
 * 取台账某一行某一列的显示文本。
 * @param {object} col { seq?:boolean, key?:string, keys?:string[], detailKeys?:string[], map?:Record<string,string> }
 * @param {object} row 单据行(表头字段 + 编号 + 单据状态 + detail.items[])
 * @param {number} idx 行序(0 起;seq 列显示 idx+1)
 * @returns {string} 显示文本(取不到即空串)
 */
export function ledgerCell(col, row, idx) {
  if (!col) return ''
  if (col.seq) return String(idx + 1)
  let v = firstNonEmpty(row, col.keys || (col.key ? [col.key] : []))
  if (!v && col.detailKeys) v = firstNonEmpty(row?.detail?.items?.[0], col.detailKeys)
  if (col.map && v && col.map[v] !== undefined) v = col.map[v]
  return v
}
