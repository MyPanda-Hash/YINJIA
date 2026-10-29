/**
 * _dump-wide.mjs —— 列出所有「纸张总宽 > 733px」的面板结构:
 *   grid 各列、pages 各页 grid、dataTables 每张表的 col 宽度合计。
 * 用途:收窄网格时必须同时确认**数据表自己的 colgroup 合计**是否跟着变,
 *   否则表格会比上面的章节窄/宽(2026-10-28 组装BOM表踩过的 colgroup 陷阱)。
 */
const { recordSheetConfigs } = await import('file:///C:/INCER/YINJIA-MES/frontend/src/core/views/recordSheetConfigs.js')

const A4 = 733
const sum = (a) => (Array.isArray(a) ? a.reduce((x, y) => x + (Number(y) || 0), 0) : 0)

for (const [k, v] of Object.entries(recordSheetConfigs)) {
  const pages = (v.pages && v.pages.length) ? v.pages : [null]
  let maxW = 0
  for (const p of pages) {
    const g = (p && p.grid) || v.grid
    maxW = Math.max(maxW, sum(g))
  }
  // 变体
  if (v.variants) {
    for (const vv of Object.values(v.variants)) maxW = Math.max(maxW, sum(vv.grid))
  }
  if (maxW <= A4) continue

  console.log('\n================ ' + k + '  最大宽 ' + maxW + ' ================')
  if (Array.isArray(v.grid)) console.log('  面板 grid  ', sum(v.grid), JSON.stringify(v.grid))
  if (v.pages) {
    v.pages.forEach((p, i) => {
      if (p.grid) console.log('  page' + i + ' grid ', sum(p.grid), JSON.stringify(p.grid), '  title=' + (p.title || ''))
    })
  }
  if (v.variants) {
    for (const [vn, vv] of Object.entries(v.variants)) {
      if (vv.grid) console.log('  变体 ' + vn, sum(vv.grid), JSON.stringify(vv.grid))
    }
  }
  // 数据表列宽(可能自带 colgroup)
  const dts = v.dataTables || []
  dts.forEach((dt, i) => {
    const cols = dt.cols || []
    const vis = cols.filter((c) => !c.hiddenCol)
    const wsum = vis.reduce((a, c) => a + (Number(c.w) || 0), 0)
    const hasW = vis.some((c) => c.w)
    console.log(`  dt${i} bar=${dt.bar || dt.pageTitle || ''} page=${dt.page ?? 0}` +
      ` 可见列${vis.length} 有w=${hasW ? 'Y' : 'N'} 合计=${wsum}` +
      (hasW ? '  ' + JSON.stringify(vis.map((c) => (c.key || c.label) + ':' + (c.w ?? '-'))).slice(0, 220) : ''))
  })
}
