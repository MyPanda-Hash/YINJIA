/**
 * _walk-p4-order.cjs — 真浏览器验证:规格书第 4 页「物料表是否紧跟 1.关键物料列表」
 *
 * 为什么必须是真浏览器:这个问题整条排查里,源码/配置/编译产物三次都显示"应该是对的",
 * 而实际纸面次序只有浏览器 DOM 说了算(踩过:克隆式实现让表落到最后章节之后、
 * v-if 与 v-for 同元素让整面板白屏 —— 两者后端日志都毫无痕迹)。
 *
 * 判定:第 4 页**可见**元素按文档序应为
 *   1.关键物料列表 → 表头(序号|物料编码|…) → 2.炭棒处理要求 → … → 6.存储环境
 * 并额外确认:物料表**只有一份可见**(曾出现 8 份、7 份 display:none)。
 *
 * 用法:node tools/archive/_walk-p4-order.cjs
 */
'use strict'
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = 'RD_SPEC_DOC'

;(async () => {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data ? login.data.token : login.token
  const user = JSON.stringify(login.data ? login.data.user : {})

  const s = await launch({ port: 9420 })
  let bad = 0
  try {
    await s.navigate(BASE + '/#/login', 2500)
    await s.evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});'ok'`)
    await s.navigate('about:blank', 400)
    await s.navigate(`${BASE}/#/panelx/list/${PANEL}`, 1500)
    for (let i = 0; i < 40; i++) {
      const n = await s.evaluate(`document.querySelectorAll('.rsp-dt-wrap').length`)
      if (typeof n === 'number' && n > 0) break
      await sleep(600)
    }
    await s.evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')].find((e) => (e.textContent || '').includes('成品及包装运输')); if (t) t.click(); return 1 })()`)
    await sleep(2200)

    const seen = JSON.parse(await s.evaluate(`JSON.stringify(
      [...document.querySelector('.record-sheet').children]
        .filter((k) => k.offsetWidth || k.offsetHeight)
        .map((k) => {
          const bar = k.querySelector && k.querySelector('.rs-sectionbar')
          const isDt = k.classList && k.classList.contains('rsp-dt-wrap')
          const ths = isDt ? [...k.querySelectorAll('th')].map((t) => t.textContent.trim()).filter(Boolean) : []
          return { kind: isDt ? 'TABLE' : (bar ? 'BAR' : 'OTHER'), text: bar ? bar.textContent.trim() : (isDt ? ths.slice(0, 6).join('|') : k.textContent.trim().slice(0, 20)) }
        })
    )`))

    console.log('=== 第 4 页可见元素(文档顺序)===')
    seen.forEach((r, i) => console.log(`  [${i}] ${r.kind.padEnd(5)} ${r.text}`))

    const bars = seen.filter((r) => r.kind === 'BAR')
    const tables = seen.filter((r) => r.kind === 'TABLE')
    console.log('')
    const ok = (n, v, d) => { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}${!v && d ? '  → ' + d : ''}`) }

    ok('6 个章节标题齐全', bars.length === 6, `实际 ${bars.length}`)
    ok('物料表只出现 1 份', tables.length === 1, `实际 ${tables.length} 份`)
    const iBar1 = seen.findIndex((r) => r.kind === 'BAR' && r.text.startsWith('1.'))
    const iTbl = seen.findIndex((r) => r.kind === 'TABLE')
    const iBar2 = seen.findIndex((r) => r.kind === 'BAR' && r.text.startsWith('2.'))
    ok('物料表紧跟「1.关键物料列表」之后', iBar1 >= 0 && iTbl === iBar1 + 1, `bar1@${iBar1} table@${iTbl}`)
    ok('物料表排在「2.炭棒处理要求」之前', iTbl >= 0 && iBar2 > iTbl, `table@${iTbl} bar2@${iBar2}`)
    ok('物料表表头 = 序号|物料编码|物料名称|规格参数|数量|备注',
      !!tables[0] && tables[0].text === '序号|物料编码|物料名称|规格参数|数量|备注', tables[0] && tables[0].text)
  } finally {
    s.close()
  }
  console.log('')
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 次序正确:表格夹在「1.关键物料列表」与「2.炭棒处理要求」之间')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
