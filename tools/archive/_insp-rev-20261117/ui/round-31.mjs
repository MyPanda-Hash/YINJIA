// round-31: 关掉残留提示框 → 回读已保存草稿(联系人=陈秀丽,样品名称/数量已落库)
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

// 清掉可能挂着的 alert
await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  const btn = box ? [...box.querySelectorAll('button')].find((b) => /去填写|确定|OK/.test(b.textContent || '')) : null
  if (btn) btn.click()
})
await T(800)

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(7000)

const state = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const cell = (k) => txt(rows.find((r) => (r.textContent || '').includes(k)))
  return {
    docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
    contact: cell('联系人'),
    sample: cell('样品名称'),
    kind: cell('样品型号/规格'),
    box: (() => { const b = document.querySelector('.el-message-box'); return b ? txt(b).slice(0, 120) : '' })(),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: dir + '/shots/round-31-saved-readback.png' })
