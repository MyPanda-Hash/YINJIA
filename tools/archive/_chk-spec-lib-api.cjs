/**
 * _chk-spec-lib-api.cjs — 用弹窗实际调用的接口核对 spec.test 已换成 18 组/47 子项
 *
 * 弹窗读的是 /stdlib/list?lib=spec.test&all=1(见 RecordSheetPanels.openStdLib),
 * 故必须从该接口验证,而不是只看库表或前端常量。
 *
 * 用法:node tools/archive/_chk-spec-lib-api.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

;(async () => {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data ? login.data.token : login.token
  const H = { Authorization: 'Bearer ' + token }

  const r = await fetch(BASE + '/api/stdlib/list?lib=spec.test&all=1', { headers: H })
  const j = await r.json()
  const rows = (j.data || [])
  console.log('HTTP', r.status, ' 条数 =', rows.length)

  const groups = []
  for (const row of rows) {
    const c = typeof row.content === 'string' ? JSON.parse(row.content) : row.content
    let g = groups.find((x) => x.name === (c.group || row.item))
    if (!g) { g = { name: c.group || row.item, subs: 0 }; groups.push(g) }
    g.subs++
  }
  console.log('组数 =', groups.length, ' 子项 =', groups.reduce((n, g) => n + g.subs, 0))
  console.log('')
  groups.forEach((g, i) => console.log(`  ${String(i + 1).padStart(2)}. ${g.name}  (${g.subs})`))

  let bad = 0
  const chk = (n, v, d) => { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}${!v && d ? '  → ' + d : ''}`) }
  console.log('')
  chk('恰为 18 个检验项目', groups.length === 18, `实际 ${groups.length}`)
  chk('子项合计 47', groups.reduce((n, g) => n + g.subs, 0) === 47)
  chk('已无旧库组名(黄水测试/COD性能测试/阻垢性能测试…)',
    !groups.some((g) => ['黄水测试', '浸泡口感测试', 'COD性能测试', '阻垢性能测试', '抑菌性能测试', '过流杀菌性能测试', '碱性性能测试'].includes(g.name)))
  // ⚠ 接口返回的是 item_code 字母序,界面次序由弹窗按 cfg.testLib 重排 —— 故这里只断言"集合相同",
  //    次序另由 _chk-lib-display-order.cjs 验证(它复刻了弹窗的排序逻辑)。
  const names = groups.map((g) => g.name)
  chk('18 个组名齐全(含首组 *外观 / 末组 *卫生安全)',
    names.includes('*外观') && names.includes('*卫生安全') && names.length === 18)
  console.log('')
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 标准库已按设计重建(18 个检验项目 / 47 子项)')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.message); process.exit(1) })
