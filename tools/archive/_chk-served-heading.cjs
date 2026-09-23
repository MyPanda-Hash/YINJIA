/**
 * _chk-served-heading.cjs — 核对服务的规格书分包里「1.关键物料列表」只声明一次
 *
 * 背景(用户报的 bug):该标题曾在 sections 与物料表的 bar 上**各声明一次** ⇒ 纸面渲染两遍。
 * 修完要能从**服务端产物**确认只剩余一处 —— 源码改对不等于用户看到的是对的。
 *
 * ⚠ 一律用 Node 取字节判 UTF-8:本会话 PowerShell 的 `-match '中文'` 已多次给出**假阴性**。
 *
 * 用法:node tools/archive/_chk-served-heading.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

;(async () => {
  const html = await (await fetch(BASE + '/')).text()
  const entry = (html.match(/\/assets\/index-[^"]+\.js/) || [])[0]
  const js = await (await fetch(BASE + entry)).text()
  const rs = (js.match(/RecordSheetPanels-[A-Za-z0-9_-]+\.js/) || [])[0]
  const txt = Buffer.from(await (await fetch(BASE + '/assets/' + rs)).arrayBuffer()).toString('utf8')

  console.log('  入口包 =', entry)
  console.log('  规格书分包 =', rs)
  const n = (txt.match(/1\.关键物料列表/g) || []).length
  console.log('  「1.关键物料列表」出现次数 =', n, '（sections 1 次是正常的;表再带 bar 就是 2 次）')
  console.log(n === 1 ? '  ✓ 只声明一次 ⇒ 标题只渲染一遍' : '  ✗ 仍重复')
  process.exit(n === 1 ? 0 : 1)
})().catch((e) => { console.error('异常:', e.message); process.exit(1) })
