// round-14.mjs —— 打开表格调整 → 恢复继承 → 确认 → 列回来(并清空本角色覆盖)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

// 1) 更多 → ▼ → 表格调整
await page.evaluate(() => {
  const more = [...document.querySelectorAll('.tb-main .act-name')].find((s) => (s.textContent || '').trim() === '更多')
  const caret = more?.closest('.tb-group')?.querySelector('.tb-caret')
  if (caret) caret.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').trim() === '表格调整')
  if (it) it.click()
})
await page.waitForTimeout(1500)

const opened = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  if (!box) return null
  return {
    scopeActive: [...box.querySelectorAll('.col-pref-scope .el-radio-button')].filter((e) => e.className.includes('is-active')).map((e) => (e.textContent || '').trim()),
    badge: (box.querySelector('.col-pref-scope .col-pref-count')?.textContent || '').replace(/\s+/g, ' ').trim(),
    checked: [...box.querySelectorAll('.col-pref-row')].map((r) => ({
      label: (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
      on: !!r.querySelector('.el-checkbox.is-checked'),
    })).filter((x) => ['单价', '金额'].some((k) => x.label.startsWith(k))),
  }
})
console.log('对话框 = ' + JSON.stringify(opened, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-14-role-dialog-customized.png' })

// 2) 恢复继承 → 确认框
const clickedReset = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  const btn = [...(box?.querySelectorAll('.el-dialog__footer button') || [])].find((b) => (b.textContent || '').trim() === '恢复继承')
  if (btn) btn.click()
  return !!btn
})
console.log('点恢复继承 = ' + clickedReset)
await page.waitForTimeout(1200)

const confirmText = await page.evaluate(() => (document.querySelector('.el-message-box__message')?.textContent || '').replace(/\s+/g, ' ').trim())
console.log('确认框 = ' + confirmText)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-14-confirm.png' })

const confirmed = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.el-message-box__btns button')]
  const ok = btns.find((b) => /确定|OK/.test((b.textContent || '').trim())) || btns[btns.length - 1]
  if (ok) ok.click()
  return (ok?.textContent || '').trim()
})
console.log('点确认 = ' + confirmed)
await page.waitForTimeout(4000)

const after = await page.evaluate(() => ({
  toast: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  badge: ([...document.querySelectorAll('.col-pref-scope .col-pref-count')][0]?.textContent || '').replace(/\s+/g, ' ').trim(),
  gridHeaders: [...document.querySelectorAll('.el-table__header th')].map((t) => (t.textContent || '').replace(/[⇅\s]/g, '')).filter(Boolean),
}))
console.log(JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-14-after-reset.png' })
