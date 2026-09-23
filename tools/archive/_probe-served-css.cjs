/**
 * _probe-served-css.cjs — 复查 8090 实际供应的 CSS 产物是否已换色
 *
 * 为什么单独查一次:前端源码改了不等于用户看到的变了 —— 8090 供应的是 backend/.../static 构建产物,
 * 而产物又打进了 jar。源码/产物/jar/服务端 四层里任何一层没刷新,用户看到的都还是旧色。
 * 本探针从**服务端**出发,沿 index.html → 入口包 → 分包的引用链逐个取回,验证最终 CSS 内容。
 *
 * 用法:node tools/archive/_probe-served-css.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  ' + e : ''}`)) }

;(async () => {
  const html = await (await fetch(BASE + '/')).text()
  const entry = (html.match(/\/assets\/index-[^"]+\.js/) || [])[0]
  console.log('  index.html 入口 =', entry)
  check('拿到入口包路径', !!entry)
  if (!entry) process.exit(1)

  const js = await (await fetch(BASE + entry)).text()
  const cssName = (js.match(/RecordSheetPanels-[A-Za-z0-9_-]+\.css/) || [])[0]
  console.log('  RecordSheetPanels CSS =', cssName)
  check('入口包引用到 RecordSheetPanels 的 CSS', !!cssName)
  if (!cssName) process.exit(1)

  const css = await (await fetch(BASE + '/assets/' + cssName)).text()
  console.log('  CSS 长度 =', css.length)
  // ⚠ 颜色字面量是 6 位 #ECEAE3(e c e a e 3),写 /ecea3/i 会漏掉中间那个 e(踩过)
  check('服务的 CSS 含新奶油灰 #ECEAE3', /eceae3/i.test(css))
  check('服务的 CSS 已无旧粉 #f9dfe2', !/f9dfe2/i.test(css))

  // ⚠ 同一类名有多条规则(基础规则 + 打印覆盖 transparent + 选中态),
  //    `.match()` 只取第一条会撞上打印覆盖(踩过)。这里取**所有** .rs-sectionbar 规则,
  //   再挑带具体颜色值的那条来断言。
  const rules = css.match(/\.rs-sectionbar[^{]*\{[^}]*\}/g) || []
  console.log('  .rs-sectionbar 规则数 =', rules.length)
  rules.forEach((r, i) => console.log(`    [${i}] ${r.slice(0, 110)}`))
  const colorRule = rules.find((r) => /background:\s*#[0-9a-f]{3,6}/i.test(r))
  check('.rs-sectionbar 有一条带具体底色的规则', !!colorRule)
  check('该规则底色为 #ECEAE3', !!colorRule && /background:\s*#?eceae3/i.test(colorRule), colorRule ? colorRule.slice(0, 80) : '')
  const printRule = rules.find((r) => /transparent/i.test(r))
  check('打印覆盖规则仍存在(打印不印色块)', !!printRule)

  // 进度查询的原则说明段:样式**并入共享分包**(实测落在 PanelxList-*.css),
  // 没有独立的 ProgressControlSheet-*.css。所以不能只在入口包里找文件名 —— 那会永远
  // 取不到而静默跳过(踩过:跳过看起来像通过)。改为把入口包直接引用的 CSS 全取回来,
  // 找到含 .ps-principle 的那一份再断言。找不到就是真失败,不是跳过。
  const cssNames = [...new Set((js.match(/[A-Za-z0-9_-]+-[A-Za-z0-9_-]+\.css/g) || []))]
  console.log('  入口包引用的 CSS 分包数 =', cssNames.length)
  let pRule = null, pHost = null
  for (const n of cssNames) {
    const t = await (await fetch(BASE + '/assets/' + n)).text()
    const rs = t.match(/\.ps-principle[^{]*\{[^}]*\}/g) || []
    if (!rs.length) continue
    pHost = n
    rs.forEach((r, i) => console.log(`    ${n} [${i}] ${r.slice(0, 130)}`))
    pRule = rs.find((r) => /background:\s*#[0-9a-f]{3,6}/i.test(r)) || null
    break
  }
  console.log('  .ps-principle 所在分包 =', pHost || '(未找到)')
  check('.ps-principle 有底色规则', !!pRule, pRule ? pRule.slice(0, 90) : '')
  check('.ps-principle 底色为 #F5F3EE 且无旧粉 #fdeef0',
    !!pRule && /f5f3ee/i.test(pRule) && !/fdeef0/i.test(pRule), pRule ? pRule.slice(0, 90) : '')

  console.log(`\n结果:${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
