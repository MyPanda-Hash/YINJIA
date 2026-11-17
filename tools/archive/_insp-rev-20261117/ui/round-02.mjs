// round-02: 新增空白草稿 → 纸面新控件取证 + 截图
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    }
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(6000)

// 点「新增」(工具条上的按钮)
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, .el-button, [role="button"]')]
  const b = btns.find((x) => (x.textContent || '').replace(/\s+/g, '') === '新增')
  if (b) { b.click(); return b.outerHTML.slice(0, 160) }
  return 'none:' + btns.map((x) => (x.textContent || '').replace(/\s+/g, '')).slice(0, 25).join('|')
})
console.log('add=' + clicked)
await page.waitForTimeout(6000)
await restoreWindow()

const paper = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  if (!sheet) return { ok: false }
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...sheet.querySelectorAll('tbody > tr')].map((tr) => txt(tr).slice(0, 220))
  const docNoInput = [...sheet.querySelectorAll('input')].find((i) => /WT-|自动生成/.test(i.value + (i.placeholder || '')))
  return {
    ok: true,
    rows,
    docNo: docNoInput ? { value: docNoInput.value, placeholder: docNoInput.placeholder } : null,
    dateInput: [...sheet.querySelectorAll('input')].some((i) => /-\\d\\d-\\d\\d/.test(i.value)),
    total: txt(sheet.querySelector('.ic-items-total')) || '(无明细则无总金额)',
    boxes: [...sheet.querySelectorAll('.ic-opt-text')].map((e) => txt(e)).slice(0, 30),
  }
})
console.log(JSON.stringify(paper, null, 2))
await page.screenshot({ path: dir + '/shots/round-02-new-blank.png' })
