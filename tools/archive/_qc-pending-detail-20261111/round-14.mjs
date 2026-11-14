/* round-14.mjs — 默认只看「已完成检验」+ 勾选放开闸门 + 条件区收起/铺开(5173,测试库) */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 60000 })
await page.waitForTimeout(7000)

const read = () => page.evaluate(() => {
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
  const m = txt.match(/共\s*(\d+)\s*条/)
  const statuses = [...new Set(bodyRows.map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    return tds[5] ? (tds[5].innerText || '').trim() : ''
  }))]
  return {
    total: m ? Number(m[1]) : null,
    rowCount: bodyRows.length,
    statuses,
    hasGated: !!document.querySelector('.gated-toggle'),
    gatedChecked: !!document.querySelector('.gated-toggle.is-checked'),
    gatedLabel: (document.querySelector('.gated-toggle') || {}).innerText || '',
    hasToggleBtn: [...document.querySelectorAll('.toolbar-query-btn')].some((b) => /条件/.test(b.innerText || '')),
    toggleBtnText: ([...document.querySelectorAll('.toolbar-query-btn')].find((b) => /条件/.test(b.innerText || '')) || {}).innerText || '',
    queryFieldsVisible: (() => {
      const el = document.querySelector('.fields.udl-fields')
      if (!el) return null
      const st = getComputedStyle(el)
      return st.display !== 'none'
    })(),
    firstCells: bodyRows[0] ? [...bodyRows[0].querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()) : [],
  }
})

console.log('默认态 ->', JSON.stringify(await read(), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-14-default.png' })

// 勾上「显示全部状态」
await page.evaluate(() => {
  const cb = document.querySelector('.gated-toggle input[type=checkbox]') || document.querySelector('.gated-toggle')
  if (cb) cb.click()
})
await page.waitForTimeout(3500)
console.log('勾选后 ->', JSON.stringify(await read(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-14-all.png' })

// 铺开条件区
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.toolbar-query-btn')].find((x) => /条件/.test(x.innerText || ''))
  if (b) b.click()
})
await page.waitForTimeout(1200)
console.log('铺开条件后 ->', JSON.stringify(await read(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-14-expanded.png' })
