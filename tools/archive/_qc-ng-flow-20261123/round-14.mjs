// round-14.mjs —— 「出货检验(功能/表观)判不合格 → 转到哪」的核查(2026-11-23,只读,不建任何单)
//  ① 合格单纸面上**没有**「去开不合格处理单」入口(按钮只在总结论=不合格时出现)
//  ② 直接打接口 POST /qc/shipInsp/ng(合格单)⇒ 服务端闸门 422,错误文案 = 本单结论不是不合格
//  ③ 目标页长什么样:直接打开已有的不合格品处理单(制程)草稿(#/panelx/list/QC_BHC?docNo=…),
//     确认跳转落点是「不合格品处理单(制程)」纸面,且纸面上有「出货检验单号 / 工单号」两格
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const SHOT = 'C:/Users/vigna/ego/qc-ng-flow-20261123'
const out = {}

async function ensureLogin() {
  const need = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
  if (!need) return
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
  await page.waitForTimeout(6000)
}
async function restoreWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

/* ① 合格单:纸面上没有 NG 入口 */
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0009', { timeout: 30000 })
await page.waitForTimeout(4000)
await ensureLogin()
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0009', { timeout: 30000 })
await page.waitForTimeout(9000)
out.approvedDoc = await page.evaluate(() => {
  const band = document.querySelector('.qr-band')
  const ng = document.querySelector('.qr-band-ng')
  const heads = [...document.querySelectorAll('.field label, .qr-head .k, label')].map((el) => (el.innerText || '').trim()).filter(Boolean)
  return {
    hash: location.hash,
    title: document.title,
    hasNgButton: !!ng,
    ngButtonText: ng ? (ng.innerText || '').trim() : '',
    bandButtons: [...(band?.querySelectorAll('.qr-band-act') || [])].map((b) => (b.innerText || '').trim()),
    verdictCells: heads.filter((h) => h.includes('检验结论') || h.includes('总结论')).slice(0, 4),
    sheetTitle: (document.querySelector('.qr-title, .qr-sheet h3')?.innerText || '').trim(),
  }
})
await restoreWin()
await page.screenshot({ path: SHOT + '/round-14-1-approved-no-ng-button.png' })

/* ② 服务端闸门:合格单打接口应被 422 拒 */
out.apiGate = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const call = async (body) => {
    const r = await fetch('/api/qc/shipInsp/ng', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
    let j = null
    try { j = await r.json() } catch (e) { j = { parseError: String(e) } }
    return { http: r.status, code: j?.code, message: j?.message }
  }
  return {
    approvedAsm: await call({ 面板: 'QC_ASM_INSP', 单据编号: 'ZJ-2026-11-0009' }),
    approvedProc: await call({ 面板: 'QC_PROC_INSP', 单据编号: 'ZC-2026-11-0006' }),
    unknownPanel: await call({ 面板: 'QC_INSP', 单据编号: 'IJ-2026-11-0001' }),
  }
})

/* ③ 目标页:不合格品处理单(制程)草稿 */
await page.goto('http://localhost:5173/#/panelx/list/QC_BHC?docNo=BHC-2026-11-0002', { timeout: 30000 })
await page.waitForTimeout(9000)
out.targetPage = await page.evaluate(() => {
  const text = (document.body.innerText || '').replace(/\s+/g, ' ')
  const paper = document.querySelector('.as-title, .qr-title')
  const labels = [...document.querySelectorAll('.as-pair .k, .as-pair .lbl, .as-q .k, [class*="pair"]')].map((el) => (el.innerText || '').trim())
  const inputs = [...document.querySelectorAll('input')].map((i) => i.value).filter(Boolean)
  return {
    hash: location.hash,
    title: document.title,
    paperTitle: (paper?.innerText || '').trim(),
    has出货检验单号: text.includes('出货检验单号'),
    has工单号: text.includes('工单号'),
    has不合格报告单号: text.includes('不合格报告单号'),
    docnos: (text.match(/BHC-\d{4}-\d{2}-\d{4}/g) || []).slice(0, 3),
    inputs: inputs.slice(0, 10),
    labelsSample: labels.slice(0, 12),
  }
})
await restoreWin()
await page.screenshot({ path: SHOT + '/round-14-2-bhc-target-page.png' })

console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: [] })
