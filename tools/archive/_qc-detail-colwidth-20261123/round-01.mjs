// round-01: 量出货检验（功能）明细表 报表列宽 / 文本截断现状
const task = await taskSpace('qc-detail-expand-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4000)

// 会话过期就自动登录
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="密码"]'))
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
  await page.waitForTimeout(5000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 30000 })
  await page.waitForTimeout(4000)
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const info = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  if (!table) return { ok: false, hash: location.hash, title: document.title, bodyHead: document.body.innerText.slice(0, 300) }
  const wrap = table.querySelector('.el-scrollbar__wrap') || table.querySelector('.el-table__body-wrapper')
  const ths = [...table.querySelectorAll('.el-table__header-wrapper thead th')]
  const rows = [...table.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 4)
  const cellsOf = (tr) => [...tr.querySelectorAll('td')]
  const first = rows[0] ? cellsOf(rows[0]) : []
  return {
    ok: true,
    hash: location.hash,
    tableWidth: table.clientWidth,
    innerScrollWidth: wrap ? wrap.scrollWidth : null,
    innerClientWidth: wrap ? wrap.clientWidth : null,
    hasHScroll: wrap ? wrap.scrollWidth > wrap.clientWidth + 1 : null,
    cols: ths.map((th, i) => ({
      i,
      label: (th.innerText || '').replace(/\s+/g, ' ').trim(),
      w: Math.round(th.getBoundingClientRect().width),
      cellText: (first[i]?.innerText || '').replace(/\s+/g, ' ').trim(),
      cellScrollW: first[i]?.querySelector('.cell')?.scrollWidth ?? null,
      cellClientW: first[i]?.querySelector('.cell')?.clientWidth ?? null,
      ws: first[i] ? getComputedStyle(first[i].querySelector('.cell') || first[i]).whiteSpace : null,
      overflow: first[i]?.querySelector('.cell') ? getComputedStyle(first[i].querySelector('.cell')).textOverflow : null,
    })),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detail-expand-20261123/round-01.png' })
await task.finish({ keep: [] })
