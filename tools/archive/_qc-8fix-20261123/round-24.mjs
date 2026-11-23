// round-24: 打包版(8090)验收: QC_BHC 时间/目录/责任人 + 明细表入口 + 看板筛选
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
const BASE = 'http://127.0.0.1:8090/'
const login = async () => {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc && pwd) {
      setVal(acc, 'admin'); setVal(pwd, '123456')
      const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
      if (btn) btn.click()
    }
  })
  await page.waitForTimeout(5000)
}
const nav = async (url, wait = 7000) => { await page.goto(BASE + '#' + url, { timeout: 60000 }); await page.waitForTimeout(wait) }
await nav('/panelx/list/QC_BHC')
await login()
await nav('/panelx/list/QC_BHC')
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('BHC-2026-09-0001'))
  if (tr) tr.click()
})
await page.waitForTimeout(2500)
console.log('BHC:', JSON.stringify(await page.evaluate(() => ({
  title: (document.querySelector('.as-title')?.innerText || '').trim(),
  titleH: Math.round(document.querySelector('.as-title')?.getBoundingClientRect().height || 0),
  info: [...document.querySelectorAll('.as-info-row')].map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()),
  railText: (document.querySelector('.doc-select, .dsr, .drp')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
  signInputs: [...document.querySelectorAll('.q-sign-input input')].map((i) => i.value),
})), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-24-8090-bhc.png' })

// 明细表两张入口/页面
for (const code of ['QC_PROC_INSP_DETAIL', 'QC_ASM_INSP_DETAIL']) {
  await nav('/panelx/list/' + code, 8000)
  console.log(code, JSON.stringify(await page.evaluate(() => ({
    title: (document.querySelector('.el-table')?.innerText || '').slice(0, 120).replace(/\s+/g, ' '),
    headers: [...document.querySelectorAll('.el-table__header th')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 8),
    rows: document.querySelectorAll('.el-table__body tr').length,
  }))))
  await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-24-8090-' + code + '.png' })
}

// 看板筛选项
await nav('/prod/plan/workOrderProgress', 9000)
console.log('BOARD:', JSON.stringify(await page.evaluate(() => ({
  selects: [...document.querySelectorAll('.wpb-controls .el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
  stats: (document.querySelector('.wpb-stats')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 100),
}))))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-24-8090-board.png' })
