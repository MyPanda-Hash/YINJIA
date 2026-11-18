// round-11: 正确带入 1 行(点 checkbox input)→ 再看保存是否被重号拒绝
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选择检验项目'))
  if (btn) btn.click()
})
await T(4500)

const inDlg = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  if (!dlg) return { ok: false }
  const row = dlg.querySelector('.el-table__body tr')
  const box = row?.querySelector('.el-checkbox')
  const input = row?.querySelector('input[type="checkbox"]')
  if (input) input.click()
  else if (box) box.click()
  return {
    ok: true,
    checked: row?.querySelector('.el-checkbox.is-checked') ? true : false,
    rowText: (row?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    btnTexts: [...dlg.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
  }
})
console.log('dlg=' + JSON.stringify(inDlg))
await T(700)

const confirmed = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  const btn = [...dlg.querySelectorAll('button')].find((b) => /带入/.test(b.textContent || '') && !b.disabled)
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('confirm=' + confirmed)
await T(4000)

const state = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    items: sheet?.querySelectorAll('.ic-items tbody tr').length,
    total: txt(sheet?.querySelector('.ic-items-total')),
    dlgOpen: [...document.querySelectorAll('.el-dialog')].some((d) => d.offsetParent),
    msg: [...document.querySelectorAll('.el-message')].map((m) => txt(m)).join(' | '),
  }
})
console.log('state=' + JSON.stringify(state))

const save = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '保存')
  if (!btn) return 'no-save'
  btn.click()
  return 'clicked'
})
console.log('save=' + save)
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
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: dir + '/shots/round-11-dup.png' })
