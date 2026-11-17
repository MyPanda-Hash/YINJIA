// round-10: 重号查重(当前草稿已被改成 WT-2026-11-9001)→ 带入 1 行 → 保存应被拒
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

const now = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    metaInputs: [...(sheet?.querySelectorAll('.ic-meta input') || [])].map((i) => i.value),
    items: sheet?.querySelectorAll('.ic-items tbody tr').length,
    editing: !!sheet && sheet.className.includes('is-editing'),
    msg: [...document.querySelectorAll('.el-message')].map((m) => txt(m)).join(' | '),
  }
})
console.log('now=' + JSON.stringify(now))

if (!now.items) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选择检验项目'))
    if (btn) btn.click()
  })
  await T(4500)
  const carried = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
    if (!dlg) return 'no-dialog'
    const row = dlg.querySelector('.el-table__body tr')
    const cb = row?.querySelector('.el-checkbox')
    if (cb) cb.click()
    const btn = [...dlg.querySelectorAll('button')].find((b) => /带入/.test(b.textContent || ''))
    if (btn) btn.click()
    return 'carried'
  })
  console.log('carry=' + carried)
  await T(3500)
}

const save = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '保存')
  if (!btn) return 'no-save'
  btn.click()
  return 'clicked'
})
console.log('save=' + save)
await T(6000)

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
await page.screenshot({ path: dir + '/shots/round-10-dup.png' })
