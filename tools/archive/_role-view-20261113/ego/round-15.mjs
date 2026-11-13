// round-15.mjs —— 表头调整:本角色里把表头「供应商」藏掉,看表单上那一格是否消失
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

// 收尾:关掉还开着的表格调整
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  box?.querySelector('.el-dialog__headerbtn')?.click()
})
await page.waitForTimeout(600)

const headerFieldsBefore = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.doc-form .el-form-item__label, .sheet-form .el-form-item__label, label')]
    .map((l) => (l.textContent || '').replace(/[:：\s]/g, '').trim()).filter(Boolean)
  return [...new Set(labels)].slice(0, 40)
})
console.log('表头字段(前) = ' + JSON.stringify(headerFieldsBefore))

// 更多 → ▼ → 表头调整
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

const dlg = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表头调整'))
  if (!box) return null
  return {
    rows: [...box.querySelectorAll('.col-pref-row')].map((r) => ({
      label: (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
      on: !!r.querySelector('.el-checkbox.is-checked'),
    })),
    scope: [...box.querySelectorAll('.col-pref-scope .el-radio-button')].filter((e) => e.className.includes('is-active')).map((e) => (e.textContent || '').trim()),
  }
})
console.log('表头调整(前 12 行) = ' + JSON.stringify((dlg?.rows || []).slice(0, 12), null, 1))
console.log('作用域 = ' + JSON.stringify(dlg?.scope))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-15-header-dialog.png' })

// 取消「供应商」
const un = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表头调整'))
  const row = [...(box?.querySelectorAll('.col-pref-row') || [])]
    .find((r) => (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim().startsWith('供应商'))
  const cb = row?.querySelector('.el-checkbox')
  if (cb) cb.click()
  return !!cb
})
console.log('取消勾选供应商 = ' + un)
await page.waitForTimeout(400)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表头调整'))
  const btn = [...(box?.querySelectorAll('.el-dialog__footer button') || [])].find((b) => (b.textContent || '').trim() === '保存')
  if (btn) btn.click()
})
await page.waitForTimeout(4500)

const after = await page.evaluate(() => ({
  toast: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  labels: [...new Set([...document.querySelectorAll('.el-form-item__label')]
    .map((l) => (l.textContent || '').replace(/[:：\s]/g, '').trim()).filter(Boolean))],
}))
console.log(JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-15-header-after.png' })
