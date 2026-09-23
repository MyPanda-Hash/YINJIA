/**
 * _probe-p4-served.cjs — 核实 8090 供应的分包里到底有没有第 4 页的新内容
 *
 * 为什么单独写一个小探针:用 PowerShell 的 Invoke-WebRequest 取回 139KB 的 JS 后
 * 再做 `-match '中文'`,结果**与实际不符**(磁盘/jar 都在、取回的内容却匹配不到)。
 * PS 在这条链上有编码与字符串处理的坑(本会话已被 PS 毁过两次中文),故改用 Node 直接取字节核对。
 *
 * 用法:node tools/archive/_probe-p4-served.cjs
 *
 * ⚠ 为什么不用 PowerShell 判:同一批字符串,PS 的
 *   `(Invoke-WebRequest).Content -match '中文'` 报**全部缺失**,而 Node 按字节解码后**全部命中**
 *   —— 是 PS 那条链上的假阴性(本会话 PS 已第三次在中文上出错)。判 UTF-8 内容一律走 Node。
 * ⚠ 这里**只查代码里真实存在的字符串**:设计样值「伊可普高品质功能炭棒」是 xlsx 里的示例数据,
 *   不该出现在实现里,所以不列进来(列进来会得到一个"无意义失败")。
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const KEYS = [
  '2.炭棒处理要求', '4.出货检验报告', '1.关键物料列表', '3.包装方式', '5.运输要求', '6.存储环境',
  '炭棒有无黑要求', '出货时附上产品出货检验报告',
  '客户项目名称',
  'rsp-cover-fields', 'rsp-cover-blockin',
]
/** 明确**不该**出现在实现里的设计样值(出现即说明把示例数据写死了) */
const MUST_NOT_APPEAR = ['伊可普高品质功能炭棒']

;(async () => {
  const html = await (await fetch(BASE + '/')).text()
  const entry = (html.match(/\/assets\/index-[^"]+\.js/) || [])[0]
  const js = await (await fetch(BASE + entry)).text()
  const rs = (js.match(/RecordSheetPanels-[A-Za-z0-9_-]+\.js/) || [])[0]
  console.log('入口包 =', entry)
  console.log('规格书分包 =', rs)

  const buf = Buffer.from(await (await fetch(BASE + '/assets/' + rs)).arrayBuffer())
  const txt = buf.toString('utf8')
  console.log('分包字节数 =', buf.length, ' / 解码字符数 =', txt.length)
  console.log('')

  let bad = 0
  for (const k of KEYS) {
    const has = txt.includes(k)
    if (!has) bad++
    console.log(`  ${has ? '✓' : '✗'} ${k}`)
  }
  for (const k of MUST_NOT_APPEAR) {
    const has = txt.includes(k)
    if (has) bad++
    console.log(`  ${has ? '✗ 不该出现' : '✓ 未出现(正确)'} ${k}`)
  }
  console.log(`\n结果:${bad ? `${bad} 项不符` : '全部符合'}`)
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.message); process.exit(1) })
