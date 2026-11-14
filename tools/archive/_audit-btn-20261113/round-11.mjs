// round-11: 测试库 —— 真点一次「审核」(草稿 → 已审核),再查「审批情况」留痕。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(800)

const readState = () => page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    doc: text(document.querySelector('.doc-chip')),
    status: text(document.querySelector('.doc-status')),
    auditor: text(document.querySelector('.foot-line, .doc-foot')),
    toolbar: [...document.querySelectorAll('.tools .tb-group')].map((g) => ({
      main: text(g.querySelector('.tb-main')),
      disabled: (g.querySelector('.tb-main')?.className || '').includes('disabled'),
    })),
    messages: [...document.querySelectorAll('.el-message__content')].map((el) => text(el)),
  }
})

const before = await readState()
console.log('BEFORE ' + JSON.stringify({ doc: before.doc, status: before.status }))

// 点「审核」
await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '审核')
  g?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(2500)
const boxOpen = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  return box ? (box.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200) : ''
})
console.log('PROMPT ' + boxOpen)
if (boxOpen) {
  await page.evaluate(() => {
    const ta = document.querySelector('.el-message-box textarea')
    if (ta) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      s.call(ta, '【验收】审核按钮直审验证（测试账套）')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      ta.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const btn = [...document.querySelectorAll('.el-message-box__btns button')]
      .find((b) => (b.textContent || '').includes('确认审核'))
    btn?.click()
  })
  await page.waitForTimeout(6000)
}
const after = await readState()
console.log('AFTER ' + JSON.stringify({ doc: after.doc, status: after.status, messages: after.messages }))
console.log('TOOLBAR ' + JSON.stringify(after.toolbar))

// 审批情况
await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '审批')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.tools .tb-menu .ctx-item')]
  const it = items.find((x) => (x.textContent || '').trim() === '审批情况')
  it?.click()
})
await page.waitForTimeout(3000)
const history = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.el-dialog .el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => text(td)))
  return { title: text(document.querySelector('.el-dialog__title')), rows }
})
console.log('HISTORY ' + JSON.stringify(history))
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-11.json', JSON.stringify({ before, after, history }, null, 2), 'utf8')
