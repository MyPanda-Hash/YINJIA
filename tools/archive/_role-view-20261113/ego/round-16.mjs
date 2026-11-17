// round-16.mjs —— 表头调整(本角色):精确取消「供应商」,看纸面上的那一格是否消失
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

// 关掉右上角残留的菜单
await page.evaluate(() => document.body.click())
await page.waitForTimeout(400)

const before = await page.evaluate(() => {
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
  return { hasSuppLabel: txt.includes('供应商'), hash: location.hash }
})
console.log('前 = ' + JSON.stringify(before))

await page.evaluate(() => {
  const more = [...document.querySelectorAll('.tb-main .act-name')].find((s) => (s.textContent || '').trim() === '更多')
  more?.closest('.tb-group')?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').trim() === '表头调整')
  if (it) it.click()
})
await page.waitForTimeout(1600)

// 精确点「供应商」(不是「供应商代码」):label 文本去掉尾巴后 === '供应商'
const hit = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表头调整'))
  const row = [...(box?.querySelectorAll('.col-pref-row') || [])].find((r) => {
    const t = (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim()
    return t.replace(/\s*(必填|已定制)$/, '') === '供应商'
  })
  const cb = row?.querySelector('.el-checkbox')
  if (cb && cb.classList.contains('is-checked')) cb.click()
  return { found: !!row, wasChecked: !!cb?.classList.contains('is-checked') }
})
console.log('点供应商 = ' + JSON.stringify(hit))
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-16-header-unchecked.png' })

await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表头调整'))
  const btn = [...(box?.querySelectorAll('.el-dialog__footer button') || [])].find((b) => (b.textContent || '').trim() === '保存')
  if (btn) btn.click()
})
await page.waitForTimeout(4500)

const after = await page.evaluate(() => {
  // 纸面表头区(右上那块单据要素)文本
  const sheet = document.querySelector('.doc-sheet, .paper-sheet, .sheet-head, .form-head') || document.body
  return {
    toast: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
    headText: (sheet.textContent || '').replace(/\s+/g, ' ').slice(0, 260),
  }
})
console.log(JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-16-header-after.png' })
