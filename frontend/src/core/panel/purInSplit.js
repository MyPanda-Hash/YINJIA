/**
 * purInSplit.js —— 采购入库单「一行明细拆成多个仓库」的**纯函数口径**(2026-11-17 客户口径)
 *
 * 【客户原话】「采购入库单在草稿状态下要可以实现一个明细划分多个仓库来存放」;
 *   确认做法时选了「直接把明细拆成多条行」,并补一句「但是来源采购订单行号和上游的行号不变」;
 *   数量口径选「各仓库合计 = 该行实收数量」。
 *
 * 【分工】真正的拆行在服务端(`PurInSplitService`,一个事务里复制行 + 分摊金额 + 拆占用链)。
 *   这里只做弹窗要用的三件事:**默认怎么分**、**分得对不对**、**还剩多少没分**。
 *   抽成纯函数是为了能被单测直接钉住 —— 校验口径一旦在弹窗里写死,下次改规则就只能靠手点。
 *
 * 【为什么校验要给出"还剩多少"】用户常见操作是"先分一仓 600,剩下的 400 给第二仓",
 *   所以每加一行都按剩余量预填、并实时显示差额;差额不为 0 时「确定拆分」不可点。
 */

/** 数量比对容差(数量列是 decimal(18,4),四舍五入后的 0.00005 不该算不平) */
export const SPLIT_EPS = 0.00005

/** 安全取数:空/非数字一律 0(用于求和,不做业务判断) */
export function numOr0(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 该行的实收数量(拆分的分母) */
export function rowTotalQty(row) {
  return numOr0(row && row['实收数量'])
}

/**
 * 一行能不能拆:必须已落库(有 id)、实收数量 > 0。
 * 没落库的新行(id 为空)要先保存 —— 服务端按 id 找行,前端没有第二条路。
 */
export function canSplitRow(row) {
  if (!row) return false
  const id = row.id ?? row.ID ?? row['行id']
  if (id === null || id === undefined || id === '') return false
  return rowTotalQty(row) > 0
}

/**
 * 打开弹窗时的默认分配:**两条** —— 第一行 = 原仓库 + 全量,第二行 = 空仓库 + 0。
 * 用户只需把第一行的数量改小、给第二行选仓库,剩下的事界面会自己算。
 */
export function defaultAllocs(row) {
  const total = rowTotalQty(row)
  const wh = (row && (row['仓库'] || row['仓库编码'])) || ''
  const bin = (row && (row['仓位编码'] || row['仓位'])) || ''
  return [
    { 仓库: wh, 仓位编码: bin, 数量: total },
    { 仓库: '', 仓位编码: '', 数量: 0 },
  ]
}

/** 已分配合计(只认正数数量;负数/空按 0) */
export function allocSum(allocs) {
  let sum = 0
  for (const a of allocs || []) sum += Math.max(0, numOr0(a && a['数量']))
  return Math.round(sum * 10000) / 10000
}

/** 还剩多少没分(正数 = 还没分完;负数 = 分超了) */
export function remainingQty(allocs, totalQty) {
  return Math.round((numOr0(totalQty) - allocSum(allocs)) * 10000) / 10000
}

/**
 * 校验分配清单。
 *
 * @param {Array} allocs   [{仓库, 仓位编码, 数量}]
 * @param {number} totalQty 该行实收数量
 * @returns {{ok:boolean, sum:number, diff:number, problems:Array<{code:string,index:number}>}}
 *   problems 只给 **code + 行号**,文案由界面用 tt() 组装(纯函数里不碰 i18n)
 */
export function validateAllocs(allocs, totalQty) {
  const list = Array.isArray(allocs) ? allocs : []
  const problems = []
  if (list.length < 2) problems.push({ code: 'needTwo', index: 0 })
  list.forEach((a, i) => {
    const wh = String((a && (a['仓库'] || a['仓库编码'])) || '').trim()
    if (!wh) problems.push({ code: 'noWh', index: i })
    if (numOr0(a && a['数量']) <= 0) problems.push({ code: 'qtyNotPositive', index: i })
  })
  const sum = allocSum(list)
  const total = numOr0(totalQty)
  const diff = Math.round((sum - total) * 10000) / 10000
  if (Math.abs(diff) > SPLIT_EPS) problems.push({ code: 'sumMismatch', index: -1 })
  return { ok: problems.length === 0, sum, diff, problems }
}

/**
 * 提交给服务端的分配清单:去掉「仓库」里的名称/编码二义 —— 统一传已选中的值,
 * 数量四舍五入到 4 位(与 decimal(18,4) 同口径),其余键不带(服务端自己解析仓库/仓位)。
 */
export function toPayload(allocs) {
  return (allocs || [])
    .map((a) => ({
      仓库: String((a && (a['仓库'] || a['仓库编码'])) || '').trim(),
      仓位编码: String((a && a['仓位编码']) || '').trim(),
      数量: Math.round(numOr0(a && a['数量']) * 10000) / 10000,
    }))
    .filter((a) => a['仓库'] !== '')
}

/** 拆完后的行摘要(对话框里"拆成 3 行:原料仓 600 / 成品仓 400") */
export function allocSummary(allocs) {
  const list = toPayload(allocs).filter((a) => a['数量'] > 0)
  return list.map((a) => `${a['仓库']} ${a['数量']}`).join(' / ')
}
