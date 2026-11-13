// round-25.mjs —— 管理员:两颗模板按钮可见 → 从系统整体复制 → 套用到「仓库管理」
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

const hasLoginForm = () => page.evaluate(() => !!document.querySelector('input[placeholder="请输入登录账号"]'))
await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
await page.waitForTimeout(2500)
if (!(await hasLoginForm())) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto('http://127.0.0.1:8091/?r=' + Date.now() + '#/login', { timeout: 60000 })
  await page.waitForTimeout(3000)
}
await page.waitForSelector('input[placeholder="请输入登录账号"]', { state: 'visible', timeout: 20000 })
await page.evaluate(() => {
  const f = [...document.querySelectorAll('.el-select__wrapper')].find((w) => (w.textContent || '').includes('YINJIA-MES'))
  if (f) f.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const t = [...document.querySelectorAll('.el-select-dropdown__item')].find((i) => (i.textContent || '').includes('测试库'))
  if (t) t.click()
})
await page.waitForTimeout(700)
await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
  if (b) b.click()
})
await page.waitForTimeout(6500)
console.log('hash=' + (await page.evaluate(() => location.hash)) + ' 用户=' + await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('mes_user') || '{}').username } catch { return '?' }
}))

await page.goto('http://127.0.0.1:8091/#/panelx/list/QC_RECV', { timeout: 60000 })
await page.waitForTimeout(7500)
const before = await page.evaluate(() => [...document.querySelectorAll('.el-table__header th')]
  .map((t) => (t.textContent || '').replace(/[⇅\s]/g, '')).filter(Boolean))
console.log('列(前 5) = ' + JSON.stringify(before.slice(0, 5)) + ` 共 ${before.length}`)

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

const dlg = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  return {
    tplButtons: [...box.querySelectorAll('.col-pref-tpl button')].map((b) => (b.textContent || '').trim()),
    scope: [...box.querySelectorAll('.col-pref-scope .el-radio-button')].filter((e) => e.className.includes('is-active')).map((e) => (e.textContent || '').trim()),
  }
})
console.log('管理员看到 = ' + JSON.stringify(dlg))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-25-admin-tpl.png' })

// 1) 从系统整体复制
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  const btn = [...box.querySelectorAll('.col-pref-tpl button')].find((b) => (b.textContent || '').includes('从系统整体复制'))
  if (btn) btn.click()
})
await page.waitForTimeout(1000)
const confirmTxt = await page.evaluate(() => (document.querySelector('.el-message-box__message')?.textContent || '').replace(/\s+/g, ' ').trim())
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.el-message-box__btns button')]
  const ok = btns.find((b) => /确定|OK/.test((b.textContent || '').trim()))
  if (ok) ok.click()
})
await page.waitForTimeout(2000)
const t1 = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('复制确认文案 = ' + confirmTxt)
console.log('复制 toast = ' + JSON.stringify(t1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-25-copied.png' })

// 2) 套用到其他角色
await page.waitForTimeout(1500)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  const btn = [...box.querySelectorAll('.col-pref-tpl button')].find((b) => (b.textContent || '').includes('套用到其他角色'))
  if (btn) btn.click()
})
await page.waitForTimeout(1600)
const applyDlg = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('套用到其他角色'))
  return box ? {
    tip: (box.querySelector('.col-pref-tip')?.textContent || '').replace(/\s+/g, ' ').trim(),
    footer: [...box.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
  } : null
})
console.log('套用弹窗 = ' + JSON.stringify(applyDlg, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-25-apply-dialog.png' })

// 打开下拉挑「仓库管理」
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('套用到其他角色'))
  box?.querySelector('.el-select__wrapper')?.click()
})
await page.waitForTimeout(900)
const options = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((i) => (i.textContent || '').trim()))
console.log('可选角色(前 8) = ' + JSON.stringify(options.slice(0, 8)))
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-select-dropdown__item')].find((i) => (i.textContent || '').includes('仓库管理'))
  if (it) it.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('套用到其他角色'))
  const btn = [...box.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定套用')
  if (btn) btn.click()
})
await page.waitForTimeout(2500)
const t2 = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('套用 toast = ' + JSON.stringify(t2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-25-applied.png' })
