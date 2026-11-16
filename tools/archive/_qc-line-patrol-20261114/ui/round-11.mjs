// round-11 — 巡线检验(QC_LINE_PATROL):只读态(已审核)纸面必须显示文本、不给可填框
// 前置:XJ-2026-11-0002 在 yj_doc_status 里被临时置为已审核(shr=admin),取证后立即还原。
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-11.mjs')"
const out = 'C:/Users/vigna/ego/qc-line-patrol-20261114'
const task = await taskSpace('qc-line-patrol-20261114')
const page = task.page('p1')

async function loginIfNeeded() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!need) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(9000)
  return true
}
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip') }
}
const SNAP = () => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const q = (s) => document.querySelector(s)
  const tdText = (field) => {
    const td = qa(`.lp-grid tbody td[data-lp="${field}"]`)[0]
    if (!td) return ''
    const i = td.querySelector('input')
    return i ? `INPUT:${i.value}` : (td.innerText || '').replace(/\s+/g, ' ').trim()
  }
  return {
    railText: qa('.doc-select-rail tbody tr').map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim()),
    editMode: !!q('.lp-sheet.is-editing'),
    inputsInPaper: qa('.lp-sheet input').length,
    editableGridInputs: qa('.lp-grid tbody td[data-lp] input').length,
    spans: qa('.lp-grid tbody td[data-lp] span.lp-text').length,
    opBtns: qa('.lp-op .lp-btn').length,
    opCol: qa('.lp-grid thead th.lp-opcol').length,
    dateIsInput: !!q('.lp-head-left input'),
    dateText: (q('.lp-head-left .lp-val')?.textContent || '').trim(),
    cells: ['巡线时间', '车间', '编号1', '长度实测1', '两液密度', '表面状态', '结果判定', '巡线人员'].map((f) => `${f}=${tdText(f)}`),
    saveDisabled: (() => {
      const b = qa('.as-side-btn').find((e) => (e.textContent || '').trim() === '保存')
      return b ? b.className.includes('disabled') : '(无保存按钮)'
    })(),
    sideBtns: qa('.as-side-btn').map((x) => (x.textContent || '').trim()).filter(Boolean),
  }
}

await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(4000)
await loginIfNeeded()
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
await restoreWindow()
// 定位到已审核那张单(左栏点「XJ-2026-11-0002」)
const clicked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.doc-select-rail tbody tr')]
  const t = rows.find((r) => (r.innerText || '').includes('XJ-2026-11-0002'))
  if (!t) return { ok: false, rows: rows.map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()) }
  t.click()
  return { ok: true }
})
await page.waitForTimeout(3500)
console.log('CLICK=' + JSON.stringify(clicked))
await restoreWindow()
const snap = await page.evaluate(SNAP)
console.log('READONLY=' + JSON.stringify(snap))
await page.screenshot({ path: out + '/round-11-01-readonly-audited.png' })
console.log('DONE')
