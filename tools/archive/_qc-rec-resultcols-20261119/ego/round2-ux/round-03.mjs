// round-03:5173 看新入口(表头「＋ 新增列」/ 增行条「＋ 新增检测结果列」/ 每列 ×)
const task = await taskSpace('qc-insp-rec-resultcols-ux-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(5000)

const dump = async (tag) => {
  const st = await page.evaluate(() => {
    const addcol = document.querySelector('.c-result .qr-addcol')
    const badge = document.querySelector('.c-result .c-result-count')
    return {
      logged: !document.querySelector('input[placeholder*="账号"]'),
      n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
      stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
      headerAddBtn: addcol ? { text: (addcol.textContent || '').trim(), rect: (() => { const r = addcol.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })() } : null,
      countBadge: badge ? (badge.textContent || '').trim() : null,
      addbarBtns: [...document.querySelectorAll('.qr-addbar .qr-add')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
      delBtns: document.querySelectorAll('.c-res-del').length,
      resultInputs: document.querySelectorAll('.qr-table tbody td.c-res input').length,
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('initial')

// ① 表头「＋ 新增列」
await page.click('.c-result .qr-addcol', { label: '表头新增列' })
await page.waitForTimeout(600)
await dump('after-header-add')
await page.click('.c-result .qr-addcol', { label: '表头再加一列' })
await page.waitForTimeout(600)
await dump('after-header-add-2')

// ② 每列 × 删掉第 2 列(先填个值,验证"右侧左移 + 确认弹窗")
await page.evaluate(() => {
  const ins = [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res input')]
  if (!ins.length) return
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  setVal(ins[0], 'A1'); setVal(ins[1], 'B2'); setVal(ins[2], 'C3')
})
await page.waitForTimeout(500)
await dump('filled-1-2-3')

const delBtn = await page.evaluate(() => !!document.querySelectorAll('.c-res-del')[1])
if (delBtn) {
  await page.evaluate(() => { const b = document.querySelectorAll('.c-res-del')[1]; if (b) b.click() })
  await page.waitForTimeout(900)
  const dialog = await page.evaluate(() => (document.querySelector('.el-message-box__message')?.textContent || '').trim())
  console.log('dialog: ' + JSON.stringify(dialog))
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-ux-20261119/round-03-del-confirm.png' })
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.el-message-box__btns button')].find((x) => (x.textContent || '').trim() === '确定')
    if (b) b.click()
  })
  await page.waitForTimeout(900)
  await dump('after-del-col2')
}

// ③ 增行条大按钮
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.qr-addbar .qr-add')].find((x) => (x.textContent || '').includes('新增检测结果列'))
  if (b) b.click()
})
await page.waitForTimeout(700)
await dump('after-bar-add')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* skip */ }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-ux-20261119/round-03-5173.png' })

// 丢弃(不保存)
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
await dump('after-reload')
