/**
 * _chk-ssr-render.cjs — 执行 SSR bundle,真渲染面板,并**验证第 4 页的元素顺序**
 *
 * 为什么必须真渲染:模板作用域问题(如 v-if 与 v-for 同元素导致 dt 丢失)会抛异常让整面板白屏,
 * 后端日志、assets、API 全是绿的 —— 只有真渲染能看到。2026-09-20 靠它定位过一次白屏。
 *
 * 本版新增:解析渲染出的 DOM,确认**表格在「2.炭棒处理要求」之前**
 * (用户口径:表格必须紧跟「1.关键物料列表」,排在 2..6 各节之前)。
 *
 * 用法:node tools/archive/_chk-ssr-render.cjs [面板码...]
 *      (需先 `npx vite build --ssr _ssr-entry.js --outDir .ssr-out`)
 */
'use strict'
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { userAgent: 'node-ssr-probe', platform: process.platform, language: 'zh-CN' }
}
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis

const PANELS = process.argv.slice(2).length ? process.argv.slice(2) : ['RD_SPEC_DOC']
const ORDER_PANEL = 'RD_SPEC_DOC'

/** 取某个可见文字在 HTML 中的首次出现位置(用于比较元素先后) */
const posOf = (html, text) => html.indexOf(text)

;(async () => {
  const mod = await import('file:///C:/INCER/YINJIA-MES/frontend/.ssr-out/_ssr-entry.js')
  let bad = 0

  for (const p of PANELS) {
    console.log('\n===== ' + p + ' =====')
    let r
    try {
      r = await mod.render(p)
    } catch (e) {
      console.log('✗ 入口抛异常:', e.message); bad++; continue
    }
    if (r.error) {
      console.log('✗ 渲染抛出异常(面板白屏的直接原因):')
      console.log(String(r.error).split('\n').slice(0, 18).join('\n'))
      bad++; continue
    }
    const html = r.html || ''
    const count = (re) => (html.match(re) || []).length
    console.log(`✓ 渲染成功,HTML ${html.length} 字符`)
    console.log(`  .rs-sectionbar=${count(/rs-sectionbar/g)}  .rsp-dt-wrap=${count(/rsp-dt-wrap/g)}  <table=${count(/<table/g)}`)

    if (p === ORDER_PANEL) {
      console.log('\n  第 4 页元素先后(按出现位置):')
      const marks = [
        ['标题 1.关键物料列表', '1.关键物料列表'],
        ['表头 序号', '序号'],
        ['表头 物料编码', '物料编码'],
        ['章节 2.炭棒处理要求', '2.炭棒处理要求'],
        ['章节 3.包装方式', '3.包装方式'],
        ['章节 4.出货检验报告', '4.出货检验报告'],
        ['章节 5.运输要求', '5.运输要求'],
        ['章节 6.存储环境', '6.存储环境'],
      ].map(([n, t]) => [n, posOf(html, t)])
      for (const [n, i] of marks) console.log(`    ${i >= 0 ? String(i).padStart(6) : '  缺  '}  ${n}`)

      const at = Object.fromEntries(marks.map(([n, i]) => [n, i]))
      const okTable =
        at['表头 物料编码'] > at['标题 1.关键物料列表'] &&
        at['表头 物料编码'] < at['章节 2.炭棒处理要求']
      console.log('')
      console.log(okTable
        ? '  ✓ 表格位于「1.关键物料列表」之后、「2.炭棒处理要求」之前(符合设计)'
        : '  ✗ 表格位置不对(应夹在 1. 与 2. 之间)')
      if (!okTable) bad++
    }

    if (r.warnings && r.warnings.length) {
      const uniq = [...new Set(r.warnings.map((w) => String(w).split('\n')[0]))]
      console.log(`  ⚠ Vue 警告 ${r.warnings.length} 条(去重 ${uniq.length}):`)
      uniq.slice(0, 4).forEach((w) => console.log('    ' + w.slice(0, 160)))
    }
  }
  console.log('')
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 全部通过')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('脚本异常:', e.message); process.exit(1) })
