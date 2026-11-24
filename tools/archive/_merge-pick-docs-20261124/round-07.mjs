// round-07:删除行 → 删除本单 → 再选单把它加回来 → 同一张单再选一次只提示"全部已在页面上"
const task = await taskSpace('merge-pick-docs-20261124')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const snap = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  if (!d) return { ok: false }
  return {
    ok: true,
    docs: [...d.querySelectorAll('.gl-doc')].map((x) => ({
      no: (x.querySelector('.gl-doc-no')?.textContent || '').trim(),
      rows: x.querySelectorAll('.el-table__body tbody tr').length,
      head: (x.querySelector('.gl-doc-head')?.textContent || '').replace(/\s+/g, ' ').trim(),
    })),
    foot: (d.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
const toasts = () => page.evaluate(() => [...document.querySelectorAll('.el-message__content, .el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()))

log('T0', JSON.stringify(await snap()))

// 1) 删掉第一张单的第 1 行(操作列的「删除行」)
const delLine = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  const doc = d.querySelectorAll('.gl-doc')[0]
  const tr = doc.querySelector('.el-table__body tbody tr')
  const tds = [...tr.querySelectorAll('td')]
  const btn = [...tds[tds.length - 1].querySelectorAll('button')].find((b) => (b.textContent || '').includes('删除行'))
  if (!btn) return { ok: false, cells: tds.length }
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true, rowsInDoc: doc.querySelectorAll('.el-table__body tbody tr').length }
})
await page.waitForTimeout(1200)
log('DEL_LINE', JSON.stringify(delLine), JSON.stringify(await snap()))

// 2) 删掉第二张单(整单)
const delDoc = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  const doc = d.querySelectorAll('.gl-doc')[1]
  const btn = [...doc.querySelectorAll('.gl-doc-head button')].find((b) => (b.textContent || '').includes('删除本单'))
  if (!btn) return { ok: false }
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true }
})
await page.waitForTimeout(1200)
log('DEL_DOC', JSON.stringify(delDoc), JSON.stringify(await snap()))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-07-deleted.png' })

// 3) 再选单,把删掉的那张单加回来
const openPick = async () => {
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
    ;[...d.querySelectorAll('.gl-bar button')].find((b) => (b.textContent || '').trim() === '选择单据')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(4000)
}
const pickRowByNo = async (no) => page.evaluate((target) => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  if (!d) return { ok: false, why: 'no picker' }
  const tr = [...d.querySelectorAll('.el-table__body tbody tr')].find((r) => (r.querySelectorAll('td')[2]?.textContent || '').trim() === target)
  if (!tr) return { ok: false, why: 'row not found' }
  tr.querySelector('td:nth-child(3)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true, tag: (tr.querySelectorAll('td')[7]?.textContent || '').trim() }
}, no)
const confirmPick = async () => {
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
      .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
    ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('加入合单'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(3500)
}

await openPick()
log('PICK1', JSON.stringify(await pickRowByNo('YJ-20261118-04')))
await confirmPick()
log('RE_ADD', JSON.stringify(await snap()), JSON.stringify(await toasts()))

// 4) 同一张单再选一次 → 只应提示"全部已在页面上",单据数不变
await page.waitForTimeout(2500)
await page.evaluate(() => document.querySelectorAll('.el-message').forEach((m) => m.remove()))
await openPick()
log('PICK2', JSON.stringify(await pickRowByNo('YJ-20261118-04')))
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('加入合单'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1500)
log('DUP_ADD', JSON.stringify(await toasts()), JSON.stringify(await snap()))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-07-readd.png' })
log('done round-07')
