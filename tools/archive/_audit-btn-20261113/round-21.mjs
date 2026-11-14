// round-21: ① 读审批情况接口,确认 AUDIT 留痕与审核意见;② 弃审还原成草稿;③ 刷新核对状态与「审核人」。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
// 关掉可能残留的弹窗
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-dialog__footer button, .el-message-box__btns button')].find((b) => /关闭|取消/.test(b.textContent || ''))
  btn?.click()
})
await page.waitForTimeout(600)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')

const hist = await page.fetch('/api/px/getApprovalHistory?panelCode=PU_ORDER&code=YJ-20261013-01', {
  headers: { authorization: 'Bearer ' + token },
})
console.log('HISTORY_HTTP ' + hist.status + ' ' + String(hist.body || '').slice(0, 500))

const un = await page.fetch('/api/px/callButton', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
  body: JSON.stringify({ panelCode: 'PU_ORDER', buttonName: '弃审', formData: { 编号: 'YJ-20261013-01' }, buttonParam: {} }),
})
console.log('UNAUDIT_HTTP ' + un.status + ' ' + String(un.body || '').slice(0, 300))

await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '刷新')
  g?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(7000)
const state = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const cells = [...document.querySelectorAll('.panelx-list *')].filter((el) => el.children.length === 0 && /审核人|审核时间/.test(el.textContent || '')).map((el) => text(el)).slice(0, 4)
  return {
    doc: text(document.querySelector('.doc-chip')),
    status: text(document.querySelector('.doc-status')),
    cells,
    toolbar: [...document.querySelectorAll('.tools .tb-group')].map((g) => ({ main: text(g.querySelector('.tb-main')), disabled: (g.querySelector('.tb-main')?.className || '').includes('disabled') })),
  }
})
console.log('RESTORED ' + JSON.stringify({ doc: state.doc, status: state.status, cells: state.cells }))
console.log('TOOLBAR ' + JSON.stringify(state.toolbar))
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-21.json', JSON.stringify({ history: String(hist.body || ''), unaudit: String(un.body || ''), state }, null, 2), 'utf8')
