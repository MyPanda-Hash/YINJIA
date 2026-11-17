// round-09.mjs —— 本角色(销售)里取消勾选「单价 / 金额」→ 保存,看表格列是否少这两列
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

// 1) 必填字段的勾选框必须是禁用的
const reqInfo = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.col-pref-row')]
  return rows.filter((r) => (r.querySelector('.cp-flag')?.textContent || '').trim() === '必填')
    .map((r) => ({
      label: (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
      checkboxDisabled: !!r.querySelector('.el-checkbox.is-disabled'),
    }))
})
console.log('必填行 = ' + JSON.stringify(reqInfo))

// 2) 取消勾选 单价 / 金额
const un = await page.evaluate(() => {
  const want = ['单价', '金额']
  const done = []
  for (const r of document.querySelectorAll('.col-pref-row')) {
    const label = (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim()
    const base = label.replace(/\s*(必填|已定制)$/, '').trim()
    if (!want.includes(base)) continue
    const cb = r.querySelector('.el-checkbox')
    if (cb && !cb.classList.contains('is-checked')) { done.push(base + '(本来就是隐藏)'); continue }
    if (cb) cb.click()
    done.push(base + '(取消勾选)')
  }
  return done
})
console.log('操作 = ' + JSON.stringify(un))
await page.waitForTimeout(500)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-09-unchecked.png' })

// 3) 保存
const saved = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  const btn = [...(box?.querySelectorAll('.el-dialog__footer button') || [])].find((b) => (b.textContent || '').trim() === '保存')
  if (btn) btn.click()
  return !!btn
})
console.log('点保存 = ' + saved)
await page.waitForTimeout(4500)

const after = await page.evaluate(() => ({
  dialogOpen: [...document.querySelectorAll('.el-dialog')].some((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整')),
  toast: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  gridHeaders: [...document.querySelectorAll('.el-table__header th')].map((t) => (t.textContent || '').replace(/[⇅\s]/g, '')).filter(Boolean),
}))
console.log(JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-09-after-save.png' })
