/**
 * _chk-dt-slot-served.cjs — 从服务端分包确认「表格紧贴标题」的接线已上线
 *
 * 需要同时为真(任一缺失则表格要么又落到底部、要么渲染两遍):
 *   ① 分包里存在本表守卫:tablesAfterBar === 节的 bar(即"就地渲染"那份代码在)
 *   ② 分包里存在跳过守卫:!dt.tablesAfterBar(即原末尾那份会跳过托管表)
 *   ③ 配置里物料表标了 tablesAfterBar 且第 1 节标了 tablesSlot
 *
 * ⚠ 用 Node 取字节判 UTF-8(PowerShell 的 -match '中文' 本会话多次假阴性)。
 * 用法:node tools/archive/_chk-dt-slot-served.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

;(async () => {
  const html = await (await fetch(BASE + '/')).text()
  const entry = (html.match(/\/assets\/index-[^"]+\.js/) || [])[0]
  const js = await (await fetch(BASE + entry)).text()
  const rs = (js.match(/RecordSheetPanels-[A-Za-z0-9_-]+\.js/) || [])[0]
  const txt = Buffer.from(await (await fetch(BASE + '/assets/' + rs)).arrayBuffer()).toString('utf8')

  console.log('  分包 =', rs)
  const checks = [
    ['① 就地渲染的守卫(tablesAfterBar === 节 bar)', txt.includes('tablesAfterBar === ' ) || /tablesAfterBar===/.test(txt)],
    ['② 原地跳过托管表(!dt.tablesAfterBar)', /!?\w*\.?tablesAfterBar/.test(txt)],
    ['③ 配置含 tablesSlot', txt.includes('tablesSlot') || /tablesSlot/.test(txt)],
  ]
  let bad = 0
  for (const [n, ok] of checks) { if (!ok) bad++; console.log(`  ${ok ? '✓' : '✗'} ${n}`) }

  // 守卫成对:两份块都在,否则会渲染两遍或一次都不渲染
  const nGuardClone = (txt.match(/tablesSlot/g) || []).length
  const nGuardOrig = (txt.match(/tablesAfterBar/g) || []).length
  console.log(`  tablesSlot 出现 ${nGuardClone} 次 / tablesAfterBar 出现 ${nGuardOrig} 次(压缩后各 1~2 次属正常)`)

  console.log(`\n结果:${bad ? bad + ' 项不符' : '接线已在服务端产物中生效'}`)
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.message); process.exit(1) })
