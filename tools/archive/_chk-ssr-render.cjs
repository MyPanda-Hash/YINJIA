/**
 * _chk-ssr-render.cjs — 执行 SSR bundle,真渲染规格书面板并报告异常/结构
 *
 * 用法:先 `npx vite build --ssr _ssr-entry.js --outDir .ssr-out`,再跑本脚本。
 *      node tools/archive/_chk-ssr-render.cjs [面板码...]
 */
'use strict'
// element-plus 在模块初始化时就摸 navigator(SSR 下 Node 没有)⇒ 先补最小 shim,
// 否则 import 阶段直接抛 "navigator is not defined",看起来像面板渲染失败(其实是探针环境问题)。
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { userAgent: 'node-ssr-probe', platform: process.platform, language: 'zh-CN' }
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis
}

const PANELS = process.argv.slice(2).length ? process.argv.slice(2) : ['RD_SPEC_DOC']

;(async () => {
  const mod = await import('file:///C:/INCER/YINJIA-MES/frontend/.ssr-out/_ssr-entry.js')
  for (const p of PANELS) {
    console.log('\n===== ' + p + ' =====')
    let r
    try {
      r = await mod.render(p)
    } catch (e) {
      console.log('✗ 入口抛异常:', e.message)
      continue
    }
    if (r.error) {
      console.log('✗ 渲染抛出异常(面板白屏的直接原因):')
      console.log(String(r.error).split('\n').slice(0, 20).join('\n'))
      continue
    }
    const html = r.html || ''
    const count = (re) => (html.match(re) || []).length
    console.log(`✓ 渲染成功,HTML ${html.length} 字符`)
    console.log(`  .rs-sectionbar = ${count(/rs-sectionbar/g)}   .rsp-dt-wrap = ${count(/rsp-dt-wrap/g)}   <table = ${count(/<table/g)}`)
    const bars = [...html.matchAll(/class="rs-sectionbar"[^>]*>[\s\S]{0,200}?<span[^>]*>([^<]{1,40})<\/span>/g)].map((m) => m[1].trim())
    if (bars.length) console.log('  章节条:', bars.join(' | '))
    const ths = [...html.matchAll(/<th[^>]*>([^<]{0,24})<\/th>/g)].map((m) => m[1].trim()).filter(Boolean)
    if (ths.length) console.log('  表头:', ths.slice(0, 24).join(' | '))
    if (r.warnings && r.warnings.length) {
      console.log(`  ⚠ Vue 警告 ${r.warnings.length} 条:`)
      r.warnings.slice(0, 6).forEach((w) => console.log('    ' + String(w).slice(0, 220)))
    }
  }
})().catch((e) => { console.error('脚本异常:', e.message); process.exit(1) })
