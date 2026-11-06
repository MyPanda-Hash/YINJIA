/**
 * verify-select-print.mjs —— 验证「排单计划」改为**只打勾选行**(2026-11-03 用户口径)
 *
 * 用户口径:「不是点击排单计划把目前生产线的所有单据打印,而是选择勾选几个打印几个的形式」。
 *
 * 做法(CDP,对着 5173 源码实例跑):
 *   1. 登录 → 工单排产页 → 选「2号车间」(截图里那条线,未完工 4 张);
 *   2. 断言:未勾选时「排单计划」按钮 disabled(点不动 = 不会整线全打);
 *   3. 勾选 2 行 → 打桩 window.print → 点「排单计划」→ 读页面内打印层:
 *      行数必须 = 2、单据编号必须 = 勾选的那两张、表头/标题照旧;
 *   4. 截图落到 shot-select-print.png(打印层留在页面上,看到的就是真会打出去的版式)。
 *
 * 用法: node verify-select-print.mjs [base]      (默认 http://localhost:5173)
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://localhost:5173'
const LINE = process.argv[3] || '2号车间'
const PICK = (process.argv[4] || '').split(',').filter(Boolean)  // 要勾的 工单号 或 客户名关键字

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9481 })
let pass = 0, fail = 0
const check = (name, ok, extra = '') => {
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? '  ' + extra : ''))
  ok ? pass++ : fail++
}

try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 950, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login', 2000); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS)); await sleep(4500)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard', 3000); await sleep(9000)

  // 选线
  console.log('选线', await s.evaluate(`(() => {
    const hit = [...document.querySelectorAll('.wb-line')].find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === ${JSON.stringify(LINE)})
    if (!hit) return 'no-node'; (hit.querySelector('.wb-line-name') || hit).click(); return 'clicked'
  })()`))
  await sleep(8000)

  // 表内行(工单号 + 客户名)
  const rowInfo = await s.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.wb-block .el-table__body tbody tr, .wb-block .el-table__body-wrapper tbody tr')]
    const out = rows.map(tr => [...tr.querySelectorAll('td')].map(td => (td.innerText||'').trim()))
    return JSON.stringify({ n: out.length, cells: out.map(c => ({ 工单号: c[1], 客户: c[3] })) })
  })()`)
  const info = JSON.parse(rowInfo)
  console.log('表格行数 =', info.n, JSON.stringify(info.cells))

  const btnJs = `(() => [...document.querySelectorAll('button')].find(b => (b.innerText || '').replace(/\\s+/g,'').startsWith('排单计划')))()`
  const btnState = await s.evaluate(`(() => {
    const b = ${btnJs}
    return JSON.stringify({ found: !!b, disabled: b ? !!b.disabled : null, text: b ? (b.innerText||'').trim() : '' })
  })()`)
  console.log('按钮初始状态 =', btnState)
  const bs = JSON.parse(btnState)
  check('未勾选时「排单计划」按钮置灰(disabled)', bs.found === true && bs.disabled === true, bs.text)

  // 勾选目标行:默认取前 2 行(点第一列的 el-checkbox)
  const wanted = PICK.length ? PICK : info.cells.slice(0, 2).map(c => c['工单号'])
  console.log('要勾选:', JSON.stringify(wanted))
  const picked = await s.evaluate(`(() => {
    const wanted = ${JSON.stringify(wanted)}
    const rows = [...document.querySelectorAll('.wb-block .el-table__body tbody tr, .wb-block .el-table__body-wrapper tbody tr')]
    const hit = []
    for (const tr of rows) {
      const t = (tr.innerText || '')
      if (!wanted.some(w => t.includes(w))) continue
      const box = tr.querySelector('td:first-child .el-checkbox')
      if (!box) continue
      ;(box.querySelector('input') || box).click()
      hit.push(t.split('\\n').slice(0, 2).join('/'))
    }
    return JSON.stringify(hit)
  })()`)
  console.log('实际勾选 =', picked)
  await sleep(1200)

  const btnAfter = JSON.parse(await s.evaluate(`(() => {
    const b = ${btnJs}
    return JSON.stringify({ disabled: b ? !!b.disabled : null, text: b ? (b.innerText||'').trim() : '' })
  })()`))
  console.log('勾选后按钮 =', JSON.stringify(btnAfter))
  check('勾选后按钮可点且显示勾选张数', btnAfter.disabled === false && btnAfter.text.includes(String(wanted.length)), btnAfter.text)

  // 打桩 window.print,保留打印层
  await s.evaluate(`(() => { window.print = function () { window.__printed = (window.__printed || 0) + 1 } ; return 'ok' })()`)
  const clickRes = await s.evaluate(`(() => { const b = ${btnJs}; if (!b) return 'no-button'; b.click(); return 'clicked' })()`)
  console.log('点按钮 =', clickRes)
  await sleep(3000)

  const layer = JSON.parse(await s.evaluate(`(() => {
    const host = document.getElementById('yj-print-host')
    const trs = host ? [...host.querySelectorAll('tbody tr')] : []
    return JSON.stringify({
      printed: window.__printed || 0,
      hasLayer: !!host,
      title: document.title,
      n: trs.length,
      rows: trs.map(tr => [...tr.querySelectorAll('td')].map(td => (td.innerText||'').trim()).slice(0, 4)),
      heads: host ? [...host.querySelectorAll('thead th')].map(t => (t.innerText||'').trim()) : [],
    })
  })()`))
  console.log('打印层 =', JSON.stringify(layer).slice(0, 1200))
  check('点一次按钮调用 window.print 1 次', layer.printed === 1, 'printed=' + layer.printed)
  check('打印层行数 = 勾选张数 ' + wanted.length, layer.n === wanted.length, 'rows=' + layer.n)
  const sheetNos = layer.rows.map(r => r[2])
  check('打印层单据编号 = 勾选的工单号', JSON.stringify(sheetNos) === JSON.stringify(wanted), JSON.stringify(sheetNos))
  check('标题仍是 成型车间排单计划', layer.title === '成型车间排单计划', layer.title)

  const png = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(new URL('./shot-select-print.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-select-print.png')

  if (s.logs.length) console.log('页面错误日志:', s.logs.slice(0, 5))
  console.log('RESULT:', fail === 0 ? 'PASS' : 'FAIL', `(pass=${pass}, fail=${fail})`)
  process.exitCode = fail === 0 ? 0 : 1
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
