/**
 * _chk-config-loads.cjs — 配置模块能否正常加载 + 规格书面板配置是否完整
 *
 * 后端无异常、分包也能取到,但"面板不见了"最常见的剩下两种原因:
 *   ① recordSheetConfigs.js 语法/运行时报错 ⇒ 模块加载失败 ⇒ 所有面板一起白屏
 *   ② 规格书面板配置被改坏(如 sections/dataTables 结构不完整)⇒ 只有该面板空
 * 本脚本把两者都查一遍。
 *
 * 用法:node tools/archive/_chk-config-loads.cjs
 */
'use strict'

;(async () => {
  let mod
  try {
    mod = await import('file:///C:/INCER/YINJIA-MES/frontend/src/core/views/recordSheetConfigs.js')
  } catch (e) {
    console.error('✗ 配置模块加载失败(所有面板都会白屏):', e.message)
    process.exit(1)
  }
  const all = mod.recordSheetConfigs
  console.log('✓ 配置模块加载成功;面板数 =', Object.keys(all).length)
  console.log('  面板列表 =', Object.keys(all).join(', '))

  const c = all.RD_SPEC_DOC
  if (!c) { console.error('✗ RD_SPEC_DOC 配置缺失'); process.exit(1) }
  console.log('\nRD_SPEC_DOC:')
  console.log('  headMode =', c.headMode)
  console.log('  pages =', (c.pages || []).map((p) => p.title).join(' | '))
  console.log('  sections 数 =', (c.sections || []).length)
  for (const s of c.sections || []) {
    console.log(`    page=${s.page} bar=${JSON.stringify(s.bar)} tablesSlot=${JSON.stringify(s.tablesSlot)} rows=${(s.rows || []).length}`)
  }
  console.log('  dataTables 数 =', (c.dataTables || []).length)
  for (const d of c.dataTables || []) {
    console.log(`    page=${d.page} bar=${JSON.stringify(d.bar)} pageTitle=${JSON.stringify(d.pageTitle)} tablesAfterBar=${JSON.stringify(d.tablesAfterBar)} cols=${(d.cols || []).length}`)
  }

  // 守卫匹配性:self 标的 tablesSlot 与表的 tablesAfterBar 必须配对,否则表一次都不渲染
  const slotBars = new Set((c.sections || []).filter((s) => s.tablesSlot).map((s) => s.bar))
  const anchored = (c.dataTables || []).filter((d) => d.tablesAfterBar)
  console.log('\n守卫配对检查:')
  console.log('  标了 tablesSlot 的节 =', [...slotBars].map((b) => JSON.stringify(b)).join(', ') || '(无)')
  for (const d of anchored) {
    const ok = slotBars.has(d.tablesAfterBar)
    console.log(`  ${ok ? '✓' : '✗'} 表(page=${d.page}) 锚点 ${JSON.stringify(d.tablesAfterBar)} ${ok ? '有对应节' : '找不到对应节 ⇒ 该表不会渲染'}`)
  }
  const unanchored = (c.dataTables || []).filter((d) => !d.tablesAfterBar)
  console.log(`  未托管的表(走末尾那段) = ${unanchored.length} 张`)

  process.exit(0)
})().catch((e) => { console.error('异常:', e.message); process.exit(1) })
