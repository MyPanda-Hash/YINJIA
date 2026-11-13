// round-26.mjs —— 管理员「套用到其他角色」:按标题定位弹窗(上一轮按文本匹配到了表格调整自己)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

// 收掉残留弹窗后重新进面板(当前会话仍是 admin/测试库)
await page.evaluate(() => document.body.click())
await page.waitForTimeout(300)
await page.goto('http://127.0.0.1:8091/#/panelx/list/QC_RECV', { timeout: 60000 })
await page.waitForTimeout(7000)

await page.evaluate(() => {
  const more = [...document.querySelectorAll('.tb-main .act-name')].find((s) => (s.textContent || '').trim() === '更多')
  more?.closest('.tb-group')?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').trim() === '表格调整')
  if (it) it.click()
})
await page.waitForTimeout(1900)

// 点「套用到其他角色」
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  const btn = [...box.querySelectorAll('.col-pref-tpl button')].find((b) => (b.textContent || '').includes('套用到其他角色'))
  if (btn) btn.click()
})
await page.waitForTimeout(1800)

const applyBox = () => page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')]
    .filter((d) => d.offsetParent !== null)
    .find((d) => (d.querySelector('.el-dialog__title')?.textContent || '').trim() === '套用到其他角色')
  return box ? {
    title: (box.querySelector('.el-dialog__title')?.textContent || '').trim(),
    tip: (box.querySelector('.col-pref-tip')?.textContent || '').replace(/\s+/g, ' ').trim(),
    footer: [...box.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
    hasSelect: !!box.querySelector('.el-select__wrapper'),
  } : null
})
console.log('套用弹窗 = ' + JSON.stringify(await applyBox(), null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-26-apply-dialog.png' })

// 打开下拉并按标题定位
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => (d.querySelector('.el-dialog__title')?.textContent || '').trim() === '套用到其他角色')
  box?.querySelector('.el-select__wrapper')?.click()
})
await page.waitForTimeout(1000)
const options = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((i) => (i.textContent || '').trim()))
console.log('可选角色 = ' + JSON.stringify(options))

await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-select-dropdown__item')].find((i) => (i.textContent || '').includes('仓库管理'))
  if (it) it.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => (d.querySelector('.el-dialog__title')?.textContent || '').trim() === '套用到其他角色')
  const btn = [...box.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定套用')
  if (btn) btn.click()
})
await page.waitForTimeout(1200)
const toast = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('套用 toast = ' + JSON.stringify(toast))
await page.waitForTimeout(1500)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-26-applied.png' })
console.log('套用后弹窗还在? ' + JSON.stringify(await applyBox()))
