// round-12: 重试「带入选中项」(点 label + 等按钮可用)
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

const dlgOpen = await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].some((d) => d.offsetParent))
console.log('dlgOpen=' + dlgOpen)
if (!dlgOpen) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选择检验项目'))
    if (btn) btn.click()
  })
  await T(4500)
}

// 取消已勾的再重新勾(保证 change 事件)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  const rows = [...dlg.querySelectorAll('.el-table__body tr')]
  rows.forEach((r) => {
    const cb = r.querySelector('.el-checkbox')
    if (cb && cb.classList.contains('is-checked')) cb.click()
  })
})
await T(800)
const checked = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  const row = dlg.querySelector('.el-table__body tr')
  const cb = row.querySelector('.el-checkbox')
  cb.click()
  return { cls: row.querySelector('.el-checkbox').className }
})
console.log('checked=' + JSON.stringify(checked))
await T(1200)

const btnState = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  const btn = [...dlg.querySelectorAll('button')].find((b) => /带入/.test(b.textContent || ''))
  return btn ? { disabled: btn.disabled, cls: btn.className, text: (btn.textContent || '').trim() } : { none: true }
})
console.log('btn=' + JSON.stringify(btnState))

const click = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  const btn = [...dlg.querySelectorAll('button')].find((b) => /带入/.test(b.textContent || ''))
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('confirm=' + click)
await T(4500)

const state = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    items: sheet?.querySelectorAll('.ic-items tbody tr').length,
    total: txt(sheet?.querySelector('.ic-items-total')),
    dlgOpen: [...document.querySelectorAll('.el-dialog')].some((d) => d.offsetParent),
  }
})
console.log('state=' + JSON.stringify(state))

const save = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '保存')
  if (!btn) return 'no-save'
  btn.click()
  return 'clicked'
})
await T(7000)
const res = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  return {
    msg: [...document.querySelectorAll('.el-message, .el-message-box, .el-notification')].map((m) => txt(m)).join(' | '),
    metaInputs: [...(sheet?.querySelectorAll('.ic-meta input') || [])].map((i) => i.value),
    items: sheet?.querySelectorAll('.ic-items tbody tr').length,
  }
})
console.log('save=' + save + ' => ' + JSON.stringify(res))
await page.screenshot({ path: dir + '/shots/round-12-dup.png' })
