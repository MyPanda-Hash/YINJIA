// round-19: 用当前会话直连 /api/px/callButton 走一次「审核」(测试账套),再用界面刷新读结果。
// 说明:界面上的点击路径已在 round-11/18 验证(弹确认框 + 保存前必填闸门);
//       本单缺 币种/汇率/仓库 三个必填,UI 保存过不去,这里直连按钮接口验证**后端** audit() 新口径。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(400)

// 关掉可能残留的提示框
await page.evaluate(() => {
  for (let i = 0; i < 3; i++) {
    const btn = [...document.querySelectorAll('.el-message-box__btns button')].find((b) => /去填写|取消/.test(b.textContent || ''))
    btn?.click()
  }
})
await page.waitForTimeout(800)

const res = await page.fetch('/api/px/callButton', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    panelCode: 'PU_ORDER',
    buttonName: '审核',
    formData: { 编号: 'YJ-20261013-01', 审核意见: '【验收】审核按钮直审(测试账套)' },
    buttonParam: {},
  }),
})
console.log('AUDIT_HTTP ' + res.status + ' ' + String(res.body || '').slice(0, 400))

// 界面刷新读结果
await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '刷新')
  g?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(6000)
const state = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    doc: text(document.querySelector('.doc-chip')),
    status: text(document.querySelector('.doc-status')),
    foot: text(document.querySelector('.foot, .doc-footer, .approval-foot, .foot-line')),
    toolbar: [...document.querySelectorAll('.tools .tb-group')].map((g) => ({
      main: text(g.querySelector('.tb-main')),
      disabled: (g.querySelector('.tb-main')?.className || '').includes('disabled'),
    })),
  }
})
console.log('AFTER_REFRESH ' + JSON.stringify({ doc: state.doc, status: state.status }))
console.log('FOOT ' + state.foot.slice(0, 200))
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
await page.waitForTimeout(3000)
const history = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => /审批情况/.test(d.textContent || ''))
  const rows = dlg ? [...dlg.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => text(td))) : []
  return rows
})
console.log('HISTORY ' + JSON.stringify(history))
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-19.json', JSON.stringify({ audit: { status: res.status, body: String(res.body || '') }, state, history }, null, 2), 'utf8')
