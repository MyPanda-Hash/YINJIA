// round-08: 用 .as-side-btn 点「保存」→ 提示 + 回读 + 截图
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

const sides = await page.evaluate(() => [...document.querySelectorAll('.as-side-btn')].map((b) => ({
  t: (b.textContent || '').replace(/\s+/g, ' ').trim(),
  tag: b.tagName,
  vis: !!b.offsetParent,
})))
console.log('side-buttons=' + JSON.stringify(sides))

const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')]
    .find((b) => (b.textContent || '').replace(/\s+/g, '') === '保存')
  if (!btn) return 'no-save'
  btn.click()
  return 'clicked'
})
console.log('save=' + clicked)
await T(8000)

const res = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  return {
    msg: [...document.querySelectorAll('.el-message, .el-message-box, .el-notification')].map((m) => txt(m)).join(' | '),
    metaInputs: [...(sheet?.querySelectorAll('.ic-meta input') || [])].map((i) => i.value),
    items: sheet?.querySelectorAll('.ic-items tbody tr').length,
    secondRow: txt([...sheet.querySelectorAll('tbody > tr')][1]),
    status: txt(document.querySelector('.approval-side')).slice(0, 80),
    chips: txt(document.querySelector('.doc-chip')),
  }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: dir + '/shots/round-08-saved.png' })
