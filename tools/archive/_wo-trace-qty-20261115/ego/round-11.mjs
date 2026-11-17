/**
 * round-11.mjs — 现役 8090(重建后)**正式库 YJ** 的看板界面取证(2026-11-15 15:3x)
 *
 * 为什么要这个脚本:ego 的常驻标签页之前登录在「YINJIA-MES·测试库」,
 *   测试库里 GD-2026-11-0028 的排产是 100(快照)→ 需交付 50,与正式库(排产 50 → 需交付 25)不同。
 *   这里强制退出重登 **正式库 YINJIA-MES**,再断言 需交付 25 / 已排 25 / 未交量 50。
 */
import { writeFileSync } from 'node:fs'
const EV = 'D:/workspace/yinjia/tools/archive/_wo-trace-qty-20261115/ego'
const APP = 'http://127.0.0.1:8090'
const LINE = '4号车间'

const task = await taskSpace('wo-trace-qty-20261115')
const page = task.page('p1')

// 强制退出:清空本地令牌/账套 → 回登录页
await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.waitForTimeout(2000)
await page.evaluate(() => { try { localStorage.clear() } catch { } })
await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.reload()
await page.waitForTimeout(4000)

const needLogin = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')))
console.log('needLogin=' + needLogin)
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => { const sel = document.querySelector('.el-select__wrapper') || document.querySelector('.el-select'); if (sel) sel.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await page.waitForTimeout(800)
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    // 精确选「YINJIA-MES」(正式库),不能选中「YINJIA-MES·测试库」
    const t = items.find((it) => (it.textContent || '').trim() === 'YINJIA-MES')
    if (t) { t.dispatchEvent(new MouseEvent('click', { bubbles: true })); return (t.textContent || '').trim() }
    return null
  })
  console.log('登录工厂=' + JSON.stringify(picked))
  await page.waitForTimeout(400)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
  await page.waitForTimeout(6500)
}
const ledger = await page.evaluate(() => [...document.querySelectorAll('*')].map((e) => (e.textContent || '').trim()).filter((t) => t === 'YINJIA-MES' || t === 'YINJIA-MES·测试库')[0] || '')
console.log('当前账套=' + JSON.stringify(ledger))

await page.goto(`${APP}/#/prod/plan/workOrderBoard`, { timeout: 45000 })
await page.reload()
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.wb-left *')].find((el) => (el.textContent || '').replace(/\s+/g, '') === '4号车间')
  if (hit) hit.setAttribute('data-e2e', 'line-hit')
})
try { await page.click('[data-e2e="line-hit"]') } catch (e) { console.log('click: ' + e.message) }
await page.waitForTimeout(7000)

const dom = await page.evaluate(() => {
  const tb = [...document.querySelectorAll('.el-table')].find((t) => (t.textContent || '').includes('需交付'))
  if (!tb) return { found: false }
  const head = [...tb.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  const cellAt = (tr, name) => {
    const i = head.findIndex((h) => h.includes(name))
    return i < 0 ? undefined : (tr.querySelectorAll('td')[i] || {}).textContent?.trim()
  }
  const tr = tb.querySelector('tbody tr')
  const p = {}
  for (const k of ['工单号', '订单数量', '本线排产数量', '当前工序', '当前工序计划量', '7天需交付', '15天需交付', '大于15天需交付', '7天已排', '未交量']) p[k] = cellAt(tr, k)
  return { found: true, pick: p }
})
console.log('DOM = ' + JSON.stringify(dom))
const v = dom.pick || {}
const num = (x) => Number(String(x ?? '').replace(/[^\d.-]/g, '') || 0)
const results = [
  ['[PASS/FAIL] 账套=正式库 YINJIA-MES', ledger === 'YINJIA-MES'],
  ['7天需交付=25(排产50×成型0.5)', num(v['7天需交付']) === 25],
  ['7天已排=25(同口径)', num(v['7天已排']) === 25],
  ['未交量=50(排产50−入库0)', num(v['未交量']) === 50],
  ['本线排产数量=25', num(v['本线排产数量']) === 25],
]
console.log(results.map(([k, ok]) => (ok ? '[PASS] ' : '[FAIL] ') + k).join('\n'))

// 证据:摘表单独成页 → printToPDF
await page.evaluate(() => {
  const tb = [...document.querySelectorAll('.el-table')].find((t) => (t.textContent || '').includes('需交付'))
  if (!tb) return
  document.body.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin:0;padding:10px;background:#fff;font-family:"Microsoft YaHei",sans-serif'
  const t = document.createElement('div')
  t.textContent = '正式库 YINJIA-MES · 工单排产 · 4号车间 · 未完工 —— 需交付(工序口径)/已排/未交量'
  t.style.cssText = 'font-size:16px;font-weight:700;margin:0 0 8px 4px;color:#1e6fb8'
  wrap.appendChild(t); wrap.appendChild(tb); document.body.appendChild(wrap)
  const st = document.createElement('style')
  st.textContent = '.el-table{height:auto!important;max-height:none!important;width:max-content!important}.el-table .el-table__body-wrapper,.el-table .el-scrollbar__wrap{overflow:visible!important;height:auto!important;max-height:none!important}.el-table .el-scrollbar__bar{display:none!important}.el-table table{width:max-content!important}.el-table th,.el-table td{white-space:nowrap!important}'
  document.head.appendChild(st)
})
await page.waitForTimeout(900)
const pdf = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 42, paperHeight: 10, marginTop: 0.15, marginBottom: 0.15, marginLeft: 0.15, marginRight: 0.15 })
const b64 = pdf?.data || pdf?.result?.data
if (b64) { writeFileSync(`${EV}/board-live-8090.pdf`, Buffer.from(b64, 'base64')); console.log('PDF OK board-live-8090.pdf') }
