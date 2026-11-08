// round-07 — 「出货检验计划」来源表格:检查频率显示真实值(测试库夹具 ZC-2026-10-0033.产品编码=C-23-11)
const OUT = 'C:/Users/vigna/ego/qc-insp-rename-20261109'
const task = await taskSpace(29)
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

// ① 强制整页重载(同 hash 的 goto 不会重新加载,前两轮因此拿到旧单头数据)
await page.reload({ timeout: 30000 })
await page.waitForTimeout(7000)
await restoreWindow()
console.log('afterReload ' + JSON.stringify(await page.evaluate(() => ({ hash: location.hash, lang: document.documentElement.lang }))))

// ② 点左栏草稿单 ZC-2026-10-0033(产品编码已被夹具改成 C-23-11)
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  const row = rows.find((r) => (r.textContent || '').includes('ZC-2026-10-0033'))
  if (!row) return { ok: false, sample: rows.slice(0, 5).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()) }
  row.click()
  return { ok: true }
})
console.log('railPick ' + JSON.stringify(picked))
await page.waitForTimeout(3500)
const head = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    docChips: [...document.querySelectorAll('.doc-chip')].map(txt),
    headInputs: [...document.querySelectorAll('.qr-head-table input')].map((i) => i.value),
    bodyInputs: [...document.querySelectorAll('.qr-grid tbody input')].map((i) => i.value).slice(0, 6),
  }
})
console.log('HEAD ' + JSON.stringify(head, null, 2))

// ③ 打「带入检验项目」→ 读表头/行/检查频率列
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-band-act2')].find((e) => (e.textContent || '').includes('带入检验项目'))
  if (el) el.click()
})
await page.waitForTimeout(3500)
const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = vis[vis.length - 1]
  const headers = [...(d?.querySelectorAll('.el-table__header th .cell') || [])].map(txt)
  const rows = [...(d?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => [...tr.querySelectorAll('td')].map(txt))
  return {
    titles: vis.map((x) => txt(x.querySelector('.el-dialog__title'))),
    headers,
    rowCount: rows.length,
    rowsSample: rows.slice(0, 4),
    freqCells: rows.slice(0, 8).map((r) => r[5]),
    freqNonEmpty: rows.map((r) => r[5]).filter((v) => v).length,
    headerHasForbidden: headers.some((h) => h.includes('不合格应对措施')),
    headerHasFreq: headers.some((h) => h.includes('检查频率')),
    bodyHasOldName: (d?.innerText || '').includes('制程检验单'),
  }
})
console.log('DIALOG ' + JSON.stringify(dlg, null, 2))
await page.screenshot({ path: OUT + '/r7-plan-dialog.png' })
console.log('DONE')
