// round-16.mjs —— 补截图 + 等页面真正就绪(轮询到有输入框/纸面再量) · 只读
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const SHOT = 'C:/Users/vigna/ego/qc-ng-flow-20261123'

async function waitReady(marker, ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const ok = await page.evaluate((m) => {
      if (document.readyState !== 'complete') return false
      if (!document.title || document.title.startsWith('单据') && m !== 'title') { /* keep */ }
      if (m === 'inputs') return document.querySelectorAll('input').length > 0
      if (m === 'bhc') return (document.body.innerText || '').includes('不合格品处理单') && [...document.querySelectorAll('input')].some((i) => i.value)
      if (m === 'sheet') return !!document.querySelector('.qr-sheet, .qr-title') && document.querySelectorAll('input').length > 0
      return true
    }, marker)
    if (ok) return true
    await page.waitForTimeout(1500)
  }
  return false
}
async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(600)
    await page.screenshot({ path: SHOT + '/' + name })
    console.log('SHOT OK ' + name)
  } catch (e) { console.log('SHOT SKIP ' + name + ': ' + e.message.slice(0, 120)) }
}

/* A. 出货检验（表观）:合格单,纸面无 NG 入口 */
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0009', { timeout: 45000 })
await page.waitForTimeout(3000)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(8000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0009', { timeout: 45000 })
}
const readyA = await waitReady('sheet', 40000)
const a = await page.evaluate(() => ({
  ready: document.readyState,
  hash: location.hash,
  title: document.title,
  hasNgButton: !!document.querySelector('.qr-band-ng'),
  ngButtons: [...document.querySelectorAll('.qr-band-ng')].map((e) => (e.innerText || '').trim()),
  bandActs: [...document.querySelectorAll('.qr-band-act')].map((e) => (e.innerText || '').trim()),
  verdictShown: (document.body.innerText.match(/检验结论[^\n]{0,12}/) || [''])[0],
  inputs: [...document.querySelectorAll('input')].map((i) => i.value).filter(Boolean).slice(0, 10),
}))
console.log('A ready=' + readyA + ' ' + JSON.stringify(a, null, 2))
await shot('round-16-1-approved-sheet.png')

/* B. 目标页:不合格品处理单(制程) */
await page.goto('http://localhost:5173/#/panelx/list/QC_BHC?docNo=BHC-2026-11-0002', { timeout: 45000 })
const readyB = await waitReady('bhc', 40000)
const b = await page.evaluate(() => {
  const text = (document.body.innerText || '').replace(/\s+/g, ' ')
  return {
    hash: location.hash,
    title: document.title,
    paperTitle: (document.querySelector('.as-title')?.innerText || '').trim(),
    has出货检验单号: text.includes('出货检验单号'),
    has工单号: text.includes('工单号'),
    has不合格报告单号: text.includes('不合格报告单号'),
    docnos: (text.match(/BHC-\d{4}-\d{2}-\d{4}/g) || []).slice(0, 3),
    inputs: [...document.querySelectorAll('input')].map((i) => i.value).filter(Boolean).slice(0, 12),
    railCount: (text.match(/共有数据\s*\d+\s*条/) || [''])[0],
  }
})
console.log('B ready=' + readyB + ' ' + JSON.stringify(b, null, 2))
await shot('round-16-2-bhc-target-page.png')

await task.finish({ keep: [] })
