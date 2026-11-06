const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
// 1) 组名控件是不是「可选可输」
const field = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('检验项目标准库')).pop()
  const isSelect = !!dlg.querySelector('.el-select')
  const ph = (dlg.querySelector('.el-select input, .el-select__placeholder') || {}).placeholder || (dlg.querySelector('.el-select') || {}).textContent || ''
  return { isSelect, ph: String(ph).replace(/\s+/g, ' ').trim().slice(0, 40) }
})
console.log('组名控件 =', JSON.stringify(field))
// 2) 造一条「同一母项的变体写法」,看是否落进同一组(然后删掉)
const res = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const content = JSON.stringify({ v: 2, group: '余氯性能测试', name: 'E2E归拢验证', req: 'E2E-REQ-归拢', method: '', basis: '' })
  const r1 = await fetch('/api/stdlib/add', { method: 'POST', headers: h, body: JSON.stringify({ lib: 'spec.test', item: '余氯性能测试', content }) })
  const j1 = await r1.json()
  // 找刚插入的 id(按 req 唯一标记)
  const r2 = await fetch('/api/stdlib/list?lib=spec.test&all=1', { headers: h })
  const j2 = await r2.json()
  const row = (j2.data || []).find((x) => String(x.content).includes('E2E-REQ-归拢'))
  return { addCode: j1.code, id: row && row.id, seq: row && row.seq, item: row && row.item }
})
console.log('新增一条变体 =', JSON.stringify(res))
// 3) 重开弹窗,看它落在哪个组、第几个
await page.evaluate(() => { const b = [...document.querySelectorAll('.el-dialog button, .el-button')].find((x) => (x.textContent || '').trim() === '取消' || (x.textContent || '').includes('关闭')); if (b) b.click() })
await page.waitForTimeout(800)
await page.evaluate(() => {
  const cands = [...document.querySelectorAll('.rs-lib-btn, .rsp-lib-pick, [class*="lib-btn"]')]
  const el = cands.find((e) => (e.textContent || '').includes('从标准库勾选')) || cands[0]
  if (el) el.click()
})
await page.waitForTimeout(3500)
const placed = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('检验项目标准库')).pop()
  const groups = [...dlg.querySelectorAll('.lib-group')]
  for (let i = 0; i < groups.length; i++) {
    const txt = (groups[i].textContent || '')
    if (txt.includes('E2E归拢验证')) {
      const name = ((groups[i].querySelector('.lib-group-name') || {}).textContent || '').trim()
      const labels = [...groups[i].querySelectorAll('.lib-sub-name')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim())
      return { groupIndex: i + 1, groupName: name, labels, subCount: labels.length }
    }
  }
  return { found: false }
})
console.log('落位 =', JSON.stringify(placed))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/after-cluster.png' })
console.log('shot =', shot)
// 4) 清理:删掉刚造的那条
const del = await page.evaluate(async (id) => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/stdlib/destroy', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ id }) })
  const j = await r.json().catch(() => ({}))
  const r2 = await fetch('/api/stdlib/list?lib=spec.test&all=1', { headers: { Authorization: 'Bearer ' + token } })
  const j2 = await r2.json()
  return { code: j.code, stillThere: (j2.data || []).some((x) => String(x.content).includes('E2E-REQ-归拢')) }
}, res.id)
console.log('清理 =', JSON.stringify(del))
