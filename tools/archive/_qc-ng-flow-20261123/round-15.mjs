// round-15.mjs —— 同 round-14 但分步打印 + 截图容错(导航未提交时不再整脚本挂掉)
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const SHOT = 'C:/Users/vigna/ego/qc-ng-flow-20261123'

async function ensureLogin() {
  const need = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
  if (!need) return false
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
  await page.waitForTimeout(7000)
  return true
}
async function goto(url, settle = 9000) {
  await page.goto(url, { timeout: 45000 })
  await page.waitForTimeout(2500)
  if (await ensureLogin()) { await page.goto(url, { timeout: 45000 }) }
  await page.waitForTimeout(settle)
}
async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
    await page.screenshot({ path: SHOT + '/' + name })
    console.log('SHOT OK ' + name)
  } catch (e) { console.log('SHOT SKIP ' + name + ': ' + e.message) }
}

/* ① 合格单纸面:有没有 NG 入口 */
await goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0009')
const step1 = await page.evaluate(() => {
  const ng = document.querySelector('.qr-band-ng')
  const band = document.querySelector('.qr-band')
  return {
    hash: location.hash,
    title: document.title,
    hasNgButton: !!ng,
    ngButtonText: ng ? (ng.innerText || '').trim() : '',
    bandButtons: [...(band?.querySelectorAll('.qr-band-act') || [])].map((b) => (b.innerText || '').trim()),
    visibleInputs: [...document.querySelectorAll('input')].map((i) => i.value).filter(Boolean).slice(0, 8),
  }
})
console.log('STEP1 ' + JSON.stringify(step1, null, 2))
await shot('round-15-1-approved-no-ng-button.png')

/* ② 服务端闸门 */
const apiGate = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const call = async (body) => {
    try {
      const r = await fetch('/api/qc/shipInsp/ng', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      })
      let j = null
      try { j = await r.json() } catch (e) { j = { parseError: String(e) } }
      return { http: r.status, code: j?.code, message: j?.message }
    } catch (e) { return { error: String(e) } }
  }
  return {
    approvedAsm: await call({ 面板: 'QC_ASM_INSP', 单据编号: 'ZJ-2026-11-0009' }),
    approvedProc: await call({ 面板: 'QC_PROC_INSP', 单据编号: 'ZC-2026-11-0006' }),
    unknownPanel: await call({ 面板: 'QC_INSP', 单据编号: 'IJ-2026-11-0001' }),
  }
})
console.log('STEP2 ' + JSON.stringify(apiGate, null, 2))

/* ③ 目标页 */
await goto('http://localhost:5173/#/panelx/list/QC_BHC?docNo=BHC-2026-11-0002')
const target = await page.evaluate(() => {
  const text = (document.body.innerText || '').replace(/\s+/g, ' ')
  return {
    hash: location.hash,
    title: document.title,
    paperTitle: (document.querySelector('.as-title')?.innerText || '').trim(),
    has出货检验单号: text.includes('出货检验单号'),
    has工单号: text.includes('工单号'),
    has不合格报告单号: text.includes('不合格报告单号'),
    docnos: (text.match(/BHC-\d{4}-\d{2}-\d{4}/g) || []).slice(0, 3),
    headInputs: [...document.querySelectorAll('input')].map((i) => i.value).filter(Boolean).slice(0, 12),
  }
})
console.log('STEP3 ' + JSON.stringify(target, null, 2))
await shot('round-15-2-bhc-target-page.png')

await task.finish({ keep: [] })
