// round-06:合单页面里点「选择单据」→ 选单窗(供应商已锁、已加入的标「已添加」)→ 再加一张 → 明细补进来
const task = await taskSpace('merge-pick-docs-20261124')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const before = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  if (!d) return { ok: false, titles: [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null).map((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim()) }
  return {
    ok: true,
    docs: [...d.querySelectorAll('.gl-doc')].map((x) => ({
      no: (x.querySelector('.gl-doc-no')?.textContent || '').trim(),
      rows: x.querySelectorAll('.el-table__body tbody tr').length,
    })),
    foot: (d.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
log('BEFORE', JSON.stringify(before))

// 点「选择单据」
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  ;[...d.querySelectorAll('.gl-bar button')].find((b) => (b.textContent || '').trim() === '选择单据')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(4000)

const picker = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  if (!d) return { ok: false }
  return {
    ok: true,
    chips: [...d.querySelectorAll('.mpd-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    rows: [...d.querySelectorAll('.el-table__body tbody tr')].slice(0, 5).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
    supplierInputVisible: [...d.querySelectorAll('.mpd-bar input')].some((i) => (i.placeholder || '') === '供应商'),
    pager: (d.querySelector('.mpd-pager')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
log('PICKER', JSON.stringify(picker, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-06-picker-again.png' })

// 勾一张还没加进来的(第 3 行) → 加入合单
const addOne = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  const trs = [...d.querySelectorAll('.el-table__body tbody tr')]
  const tr = trs[2]
  const no = (tr.querySelectorAll('td')[2]?.textContent || '').trim()
  tr.querySelector('td:nth-child(3)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { no, total: trs.length }
})
await page.waitForTimeout(600)
const pickState = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  return (d.querySelector('.mpd-picked')?.textContent || '').replace(/\s+/g, ' ').trim()
})
log('ADD_ONE', JSON.stringify(addOne), pickState)

await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('加入合单'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(6000)

const after = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  const toast = [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    docs: [...d.querySelectorAll('.gl-doc')].map((x) => ({
      no: (x.querySelector('.gl-doc-no')?.textContent || '').trim(),
      rows: x.querySelectorAll('.el-table__body tbody tr').length,
    })),
    foot: (d.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
    toast,
  }
})
log('AFTER', JSON.stringify(after, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-06-after-add.png' })
log('done round-06')
