// round-02:点「合单生单」→ 选单弹窗是否出来;顺手确认当前登录工厂
const task = await taskSpace('merge-pick-docs-20261124')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const ls = await page.evaluate(() => {
  const out = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    const v = localStorage.getItem(k) || ''
    out[k] = v.length > 200 ? v.slice(0, 200) + '…' : v
  }
  return out
})
log('LOCALSTORAGE', JSON.stringify(ls))

// 打开下拉 → 点「合单生单」
const step = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  if (!g) return { ok: false, why: 'no group' }
  if (!document.querySelector('.tb-menu')) g.querySelector('.tb-caret')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true }
})
await page.waitForTimeout(700)
const clicked = await page.evaluate(() => {
  const item = [...document.querySelectorAll('.tb-menu .ctx-item')].find((e) => (e.textContent || '').trim() === '合单生单')
  if (!item) return { ok: false, menu: [...document.querySelectorAll('.tb-menu .ctx-item')].map((e) => (e.textContent || '').trim()) }
  item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true }
})
log('CLICK', JSON.stringify(step), JSON.stringify(clicked))
await page.waitForTimeout(3500)

const dlg = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  return boxes.map((d) => ({
    title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(),
    chips: [...d.querySelectorAll('.mpd-chip, .mpd-bar span')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    headers: [...d.querySelectorAll('.el-table__header th')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
    rows: [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
    footer: [...d.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
    pager: (d.querySelector('.mpd-pager')?.textContent || '').replace(/\s+/g, ' ').trim(),
    empty: (d.querySelector('.el-table__empty-text')?.textContent || '').trim(),
  }))
})
log('DIALOG', JSON.stringify(dlg, null, 1))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-02-picker.png' })
log('done round-02')
