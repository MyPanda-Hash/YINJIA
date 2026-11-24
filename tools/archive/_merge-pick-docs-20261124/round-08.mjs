// round-08:同一张单只补丢失的那一行(7→8)→ 删到只剩一张单时点「确定合单生单」应被拦住(不写库)
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
    })),
    foot: (d.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
const toasts = () => page.evaluate(() => [...new Set([...document.querySelectorAll('.el-message__content')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()))])

// 1) 再选 YJ-20261120-03(页面上只有 7 行,原单 8 行)→ 应只补 1 行
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  ;[...d.querySelectorAll('.gl-bar button')].find((b) => (b.textContent || '').trim() === '选择单据')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message')].forEach((m) => m.remove())
  const box = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  const tr = [...box.querySelectorAll('.el-table__body tbody tr')].find((r) => (r.querySelectorAll('td')[2]?.textContent || '').trim() === 'YJ-20261120-03')
  tr?.querySelector('td:nth-child(3)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(600)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  ;[...box.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('加入合单'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1500)
log('PATCH_ONE', JSON.stringify(await toasts()), JSON.stringify(await snap()))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-08-patch-one.png' })

// 2) 删掉两张单,只剩一张时点「确定合单生单」→ 应被前端拦住(不请求后端、不写库)
await page.waitForTimeout(2000)
await page.evaluate(() => document.querySelectorAll('.el-message').forEach((m) => m.remove()))
const delTwo = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  const docs = [...d.querySelectorAll('.gl-doc')]
  for (const doc of docs.slice(1)) {
    const btn = [...doc.querySelectorAll('.gl-doc-head button')].find((b) => (b.textContent || '').includes('删除本单'))
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }
  return { left: d.querySelectorAll('.gl-doc').length }
})
await page.waitForTimeout(1200)
log('DEL_TWO', JSON.stringify(delTwo), JSON.stringify(await snap()))

const guard = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定合单生单')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { clicked: !!btn, disabled: btn?.disabled === true }
})
await page.waitForTimeout(1800)
log('GUARD', JSON.stringify(guard), JSON.stringify(await toasts()))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-08-guard.png' })

// 收尾:取消,不生成任何单据
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '取消')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1500)
const closed = await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => (d.querySelector('.el-dialog__title')?.textContent || '').trim()))
log('CLOSED', JSON.stringify(closed))
log('done round-08')
