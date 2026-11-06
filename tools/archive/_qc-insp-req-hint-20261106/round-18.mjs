const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

async function openDoc(no) {
  await page.goto('http://localhost:5173/#/dashboard', { timeout: 45000 })
  await page.reload({ timeout: 45000 })
  await page.waitForTimeout(4000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=' + no, { timeout: 45000 })
  await page.waitForTimeout(8000)
}

function dump() {
  return page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('来料检验要求'))
    const btns = d ? [...d.querySelectorAll('.el-dialog__footer button')].map((b) => ({
      text: (b.innerText || '').replace(/\s+/g, ' ').trim(),
      disabled: !!b.disabled || b.classList.contains('is-disabled'),
    })) : []
    return {
      dialogOpen: !!d,
      sub: d ? (d.querySelector('.req-view-sub')?.innerText || '').replace(/\s+/g, ' ').trim() : '',
      footerBtns: btns,
      hint: d ? [...d.querySelectorAll('.req-view-carry-hint')].map((n) => (n.innerText || '').trim()) : [],
      toasts: [...document.querySelectorAll('.el-message')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()),
      status: (() => { const t = document.querySelector('.doc-status'); return t ? (t.innerText || '').trim() : '' })(),
      itemRows: [...document.querySelectorAll('.qr-table tbody tr')].map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)).slice(0, 6),
      itemRowCount: document.querySelectorAll('.qr-table tbody tr').length,
    }
  })
}

// ── ① 草稿 + 有要求 + 空表体:弹窗里点「带入检验要求」应真的带进来并关弹窗 ──
await openDoc('JYSJ-2026-10-0077')
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-lib-btn')].find((n) => (n.textContent || '').includes('检验要求') && !(n.textContent || '').includes('带入'))
  if (el) el.click()
})
await page.waitForTimeout(4000)
console.log('① 打开弹窗: ' + JSON.stringify(await dump(), null, 2))

await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('来料检验要求'))
  const btn = d && [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.innerText || '').includes('带入检验要求'))
  if (btn) btn.click()
})
await page.waitForTimeout(4000)
console.log('② 点带入后: ' + JSON.stringify(await dump(), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-18a.png' })

// ── ② 已审核单:按钮必须置灰并给出原因 ──
await openDoc('JYSJ-2026-09-0048')
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-lib-btn')].find((n) => (n.textContent || '').includes('检验要求') && !(n.textContent || '').includes('带入'))
  if (el) el.click()
})
await page.waitForTimeout(4000)
console.log('③ 已审核单: ' + JSON.stringify(await dump(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-18b.png' })
