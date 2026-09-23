/**
 * _chk-lib-display-order.cjs — 模拟弹窗的分组+排序逻辑,确认界面**显示次序**与设计一致
 *
 * 背景:接口 /stdlib/list 返回的组是按 item_code 字母序,而弹窗会按
 *   cfg.testLib(内置常量)的组名顺序**重排**(见 RecordSheetPanels.openStdLib 里的 groups.sort)。
 * 故"接口顺序"不等于"界面顺序";必须按弹窗那套逻辑算一遍,才能判断用户看到的次序对不对。
 *
 * 用法:node tools/archive/_chk-lib-display-order.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

;(async () => {
  const cfgMod = await import('file:///C:/INCER/YINJIA-MES/frontend/src/core/views/recordSheetConfigs.js')
  const order = (cfgMod.recordSheetConfigs.RD_SPEC_DOC.testLib || []).map((g) => g.name)
  console.log('cfg.testLib 组序(内置常量)=', order.length, '组')

  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data ? login.data.token : login.token
  const rows = (await (await fetch(BASE + '/api/stdlib/list?lib=spec.test&all=1',
    { headers: { Authorization: 'Bearer ' + token } })).json()).data || []

  // 复刻弹窗逻辑:按 content.group 归组,再按 order 排序(不在 order 里的缀后)
  const groups = []
  for (const r of rows) {
    const c = typeof r.content === 'string' ? JSON.parse(r.content) : r.content
    const name = c.group || r.item
    let g = groups.find((x) => x.name === name)
    if (!g) { g = { name, subs: [] }; groups.push(g) }
    g.subs.push(c)
  }
  groups.sort((a, b) => {
    const ia = order.indexOf(a.name); const ib = order.indexOf(b.name)
    return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib)
  })

  console.log('')
  console.log('=== 界面显示次序(按弹窗逻辑重排后)===')
  groups.forEach((g, i) => console.log(`  ${String(i + 1).padStart(2)}. ${g.name}  (${g.subs.length} 子项)`))

  const DESIGN = (await import('file:///C:/INCER/YINJIA-MES/frontend/src/core/views/specTestLib.js')).SPEC_TEST_LIB.map((g) => g.name)
  console.log('')
  const got = groups.map((g) => g.name)
  const same = JSON.stringify(got) === JSON.stringify(DESIGN)
  console.log(same ? '✓ 界面次序与设计的 18 个检验项目完全一致' : '✗ 次序不一致')
  if (!same) {
    console.log('  设计序 =', JSON.stringify(DESIGN))
    console.log('  实际序 =', JSON.stringify(got))
  }
})()
