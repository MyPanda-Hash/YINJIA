/**
 * round-06.mjs — 英文态取证(避开 page.click('.locale-switch') 零尺寸元素的老毛病):
 * 直接把 localStorage.mes_locale 置 en 后 reload —— 与用户切语言等价(i18n/store 的持久化键)。
 * 断言:完工数据列头全英文、工序列值走 tt()(成型→Moulding 之类)、无中文残留。
 * 收尾把语言切回 zh-CN。
 */
import { writeFileSync } from 'node:fs'
const EV = 'D:/workspace/yinjia/tools/archive/_wo-trace-qty-20261115/ego'
const APP = 'http://127.0.0.1:8091'

const task = await taskSpace('wo-trace-qty-20261115')
const page = task.page('p1')
const results = []
const check = (label, actual, ok) => results.push(`${ok ? '[PASS]' : '[FAIL]'} ${label} = ${JSON.stringify(actual)}`)

await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.waitForTimeout(3500)
const needLogin = await page.evaluate(() =>
  [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      if (!el) return
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const sel = document.querySelector('.el-select__wrapper') || document.querySelector('.el-select')
    if (sel) sel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const t = items.find((it) => {
      const x = (it.textContent || '').replace(/\s+/g, '')
      return x.includes('YINJIA-MES') && !x.includes('测试')
    }) || items[0]
    if (t) t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (b) b.click()
  })
  await page.waitForTimeout(6000)
}

// 切英文:直接置 localStorage 后**整页 goto**(新文档即按 en 引导;不要 reload —— reload 会丢 ?focus= 自动开窗)
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.goto(`${APP}/#/prod/plan/workOrderList?keyword=GD-2026-11-0028-1&focus=3210`, { timeout: 45000 })
await page.waitForTimeout(14000)

const en = await page.evaluate(() => {
  // 英文态下区块标题被译成英文 ⇒ 用「表头含 Pending Qty / conversion rate 的那张 el-table」反找所属块
  const tables = [...document.querySelectorAll('.el-table')]
  const withHead = tables.map((tb) => ({
    tb,
    head: [...tb.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  }))
  const hit = withHead.find((x) => x.head.some((h) => /Pending Qty/i.test(h)))
    || withHead.find((x) => x.head.some((h) => /conversion rate/i.test(h)))
  const tb = hit ? hit.tb : null
  const block = tb ? tb.closest('.wb-trace-block') : null
  return {
    head: hit ? hit.head : [],
    rows: tb ? [...tb.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())) : [],
    blockText: block ? (block.innerText || '').replace(/\s+/g, ' ').trim() : '',
    locale: localStorage.getItem('mes_locale'),
  }
})
console.log('EN 完工数据表头 = ' + JSON.stringify(en.head))
console.log('EN 完工数据行 = ' + JSON.stringify(en.rows))
check('列头全英文(换算率→conversion rate)', en.head.join(' / '), en.head.some((h) => h.toLowerCase().includes('conversion rate')))
check('列头含 Pending Qty', en.head.join(' / '), en.head.some((h) => h.includes('Pending Qty')))
const cnResidue = en.head.filter((h) => /[\u4e00-\u9fa5]/.test(h))
check('列头无中文残留', cnResidue, cnResidue.length === 0)
const firstCol = (en.rows[0] || [])[0] || ''
check('工序列值走 tt()(已译)', firstCol, !!firstCol && !/[\u4e00-\u9fa5]/.test(firstCol) && firstCol.length > 0)

// 英文态 PDF 留证
await page.evaluate(() => {
  const st = document.createElement('style')
  st.textContent = `
    body > :not(.el-overlay){display:none!important}
    body > .el-overlay{position:static!important;display:block!important;background:#fff!important;overflow:visible!important}
    .el-overlay-dialog{overflow:visible!important;display:block!important;height:auto!important}
    .el-dialog{margin:0 auto!important;max-height:none!important;height:auto!important;width:98%!important;box-shadow:none!important}
    .el-dialog__body{max-height:none!important;overflow:visible!important;padding:8px!important}
    .el-table{max-height:none!important;height:auto!important}
    .el-table .el-scrollbar__wrap,.el-table .el-table__body-wrapper{max-height:none!important;overflow:visible!important;height:auto!important}
    .el-table .el-scrollbar__bar{display:none!important}`
  document.head.appendChild(st)
})
await page.waitForTimeout(1200)
try {
  const pdf = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 12, paperHeight: 34, marginTop: 0.2, marginBottom: 0.2, marginLeft: 0.2, marginRight: 0.2 })
  const b64 = pdf?.data || pdf?.result?.data
  if (b64) { writeFileSync(`${EV}/trace-dialog-8091-en.pdf`, Buffer.from(b64, 'base64')); console.log('PDF OK en') }
} catch (e) { console.log('pdf en fail: ' + e.message) }

// 收尾:切回中文
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
console.log('\n' + results.join('\n'))
const fail = results.filter((x) => x.startsWith('[FAIL]')).length
console.log(fail === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fail})`)
