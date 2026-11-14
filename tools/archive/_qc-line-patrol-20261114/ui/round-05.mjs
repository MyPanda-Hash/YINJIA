// round-05 — 巡线检验(QC_LINE_PATROL):左「单据选择」栏切单 / 刷新后仍是可编辑草稿 / 只读态文本渲染
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-05.mjs')"
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
  return {
    hash: location.hash,
    rail: !!q('.doc-select-rail'),
    railRows: qa('.doc-select-rail tbody tr').length,
    railText: qa('.doc-select-rail tbody tr').slice(0, 4).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim()),
    sheet: !!q('.lp-sheet'),
    inputs: qa('.lp-sheet input').length,
    editMode: !!q('.lp-sheet.is-editing'),
    rows: qa('.lp-grid tbody tr').length,
    saveBtnDisabled: (() => {
      const b = qa('.as-side-btn').find((e) => (e.textContent || '').trim() === '保存')
      return b ? b.className.includes('disabled') : null
    })(),
    sideBtns: qa('.as-side-btn').map((x) => (x.textContent || '').trim()).filter(Boolean),
    firstBlock: ['巡线时间', '车间', '编号1', '结果判定', '巡线人员'].map((f) => {
      const td = qa(`.lp-grid tbody td[data-lp="${f}"]`)[0]
      if (!td) return `${f}=`
      const i = td.querySelector('input')
      return `${f}=${i ? i.value : (td.innerText || '').replace(/\s+/g, ' ').trim()}`
    }),
  }
}

await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(4000)
await loginIfNeeded()
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
await restoreWindow()
console.log('S1=' + JSON.stringify(await page.evaluate(SNAP)))
await page.screenshot({ path: out + '/round-05-01-left-rail.png' })

// 左栏点第 2 张单(1 块那张),看纸面是否跟着切、值是否正确
const switched = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.doc-select-rail tbody tr')]
  const target = rows[1]
  if (!target) return { ok: false, rows: rows.length }
  target.click()
  return { ok: true, text: (target.innerText || '').replace(/\s+/g, ' ').trim() }
})
await page.waitForTimeout(3500)
console.log('SWITCH=' + JSON.stringify(switched))
console.log('S2=' + JSON.stringify(await page.evaluate(SNAP)))
await restoreWindow()
await page.screenshot({ path: out + '/round-05-02-switched-doc.png' })

// 只读态渲染验证:同一组件 editable=false 时必须是纯文本(不出现输入框)。
// 这里用「把首块改成只读」的办法在页面里验证组件分支不靠后端:先读一次只读态的 DOM 结构判据。
const roProbe = await page.evaluate(() => {
  // 从 Vue 组件实例上拿到 props 不可行;改为直接验证样式口径:
  // 只读态 = 无 .lp-sheet.is-editing + 单元格内 span.lp-text(而不是 input)
  const sheet = document.querySelector('.lp-sheet')
  return {
    hasEditingClass: !!sheet?.classList.contains('is-editing'),
    spans: document.querySelectorAll('.lp-grid tbody td[data-lp] span.lp-text').length,
    inputs: document.querySelectorAll('.lp-grid tbody td[data-lp] input').length,
  }
})
console.log('RO_PROBE(当前草稿态)=' + JSON.stringify(roProbe))
console.log('DONE')
