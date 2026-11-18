// round-01:在正式账套(8090 + YINJIA-MES)复现用户所见:步进器在不在、点 ＋ 能不能加列
const task = await taskSpace('qc-insp-rec-resultcols-ux-20261119')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(6000)

const dump = async (tag) => {
  const st = await page.evaluate(() => {
    const step = document.querySelector('.qr-colstep')
    const r = step ? step.getBoundingClientRect() : null
    const btn = document.querySelector('.qr-colstep > span:nth-child(4)')
    const br = btn ? btn.getBoundingClientRect() : null
    return {
      ledger: (document.body.innerText || '').split('\n')[0] || '',
      stepperText: step ? (step.textContent || '').replace(/\s+/g, ' ').trim() : null,
      stepperRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      plusRect: br ? { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) } : null,
      headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
      editableInputs: document.querySelectorAll('.qr-table tbody td.c-res input').length,
      status: (document.body.innerText.match(/(草稿|已审核|审批中|已归档)/) || [])[1] || null,
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('initial')

// 点两次 ＋(只在本地内存里改,不保存)
await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' })
await page.waitForTimeout(500)
await dump('after-plus-1')
await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' })
await page.waitForTimeout(500)
await dump('after-plus-2')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* skip */ }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-ux-20261119/round-01-8090-after-plus.png' })

// 丢弃未保存改动
await page.reload({ timeout: 40000 })
await page.waitForTimeout(5000)
await dump('after-reload')
