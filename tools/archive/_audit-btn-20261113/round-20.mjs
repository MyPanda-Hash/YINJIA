// round-20: 带 Bearer 令牌直连 /api/px/callButton 走一次「审核」(测试账套),再刷新界面读结果 + 审批情况。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(400)

const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
console.log('TOKEN_LEN ' + token.length)
const res = await page.fetch('/api/px/callButton', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
  body: JSON.stringify({
    panelCode: 'PU_ORDER',
    buttonName: '审核',
    formData: { 编号: 'YJ-20261013-01', 审核意见: '【验收】审核按钮直审(测试账套)' },
    buttonParam: {},
  }),
})
console.log('AUDIT_HTTP ' + res.status + ' ' + String(res.body || '').slice(0, 400))

await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '刷新')
  g?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(7000)
const state = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const body = [...document.querySelectorAll('.panelx-list *')].filter((el) => el.children.length === 0 && /审核人|审核日期|审核时间|审核意见/.test(el.textContent || '')).map((el) => text(el)).slice(0, 8)
  return {
    doc: text(document.querySelector('.doc-chip')),
    status: text(document.querySelector('.doc-status')),
    auditCells: body,
    toolbar: [...document.querySelectorAll('.tools .tb-group')].map((g) => ({
      main: text(g.querySelector('.tb-main')),
      disabled: (g.querySelector('.tb-main')?.className || '').includes('disabled'),
    })),
  }
})
console.log('AFTER ' + JSON.stringify({ doc: state.doc, status: state.status }))
console.log('AUDITCELLS ' + JSON.stringify(state.auditCells))
console.log('TOOLBAR ' + JSON.stringify(state.toolbar))

// 审批情况
await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '审批')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.tools .tb-menu .ctx-item')].find((x) => (x.textContent || '').trim() === '审批情况')
  it?.click()
})
await page.waitForTimeout(3500)
const history = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => /审批情况/.test(d.textContent || ''))
  return dlg ? [...dlg.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => text(td))) : []
})
console.log('HISTORY ' + JSON.stringify(history))
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-20.json', JSON.stringify({ http: res.status, body: String(res.body || ''), state, history }, null, 2), 'utf8')
