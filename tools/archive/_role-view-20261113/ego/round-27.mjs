// round-27.mjs —— 8090(打包版/正式库)只读确认:序号输入 + 两颗模板按钮都在(不保存)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip') }

const hasLoginForm = () => page.evaluate(() => !!document.querySelector('input[placeholder="请输入登录账号"]'))
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 60000 })
await page.waitForTimeout(2500)
if (!(await hasLoginForm())) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto('http://127.0.0.1:8090/?r=' + Date.now() + '#/login', { timeout: 60000 })
  await page.waitForTimeout(3000)
}
await page.waitForSelector('input[placeholder="请输入登录账号"]', { state: 'visible', timeout: 20000 })
// 工厂 = 正式库(YINJIA-MES)
await page.evaluate(() => {
  const f = [...document.querySelectorAll('.el-select__wrapper')].find((w) => (w.textContent || '').includes('YINJIA-MES'))
  if (f) f.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const t = [...document.querySelectorAll('.el-select-dropdown__item')].find((i) => (i.textContent || '').trim() === 'YINJIA-MES')
  if (t) t.click()
})
await page.waitForTimeout(600)
await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
  if (b) b.click()
})
await page.waitForTimeout(6500)
console.log('hash=' + (await page.evaluate(() => location.hash)))

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_RECV', { timeout: 60000 })
await page.waitForTimeout(7500)
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
  if (!box) return null
  const rows = [...box.querySelectorAll('.col-pref-row')]
  return {
    scope: [...box.querySelectorAll('.col-pref-scope .el-radio-button')].filter((e) => e.className.includes('is-active')).map((e) => (e.textContent || '').trim()),
    tip: (box.querySelector('.col-pref-tip')?.textContent || '').replace(/\s+/g, ' ').trim(),
    tplButtons: [...box.querySelectorAll('.col-pref-tpl button')].map((b) => (b.textContent || '').trim()),
    seqInputs: box.querySelectorAll('.cp-seq-input').length,
    first3: rows.slice(0, 3).map((r) => ({
      label: (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
      seq: r.querySelector('.cp-seq-input input')?.value ?? null,
    })),
  }
})
console.log('8090 弹窗 = ' + JSON.stringify(dlg, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-27-8090-seq.png' })

// 只读:关掉,不保存(正式库不做任何写入)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  box?.querySelector('.el-dialog__headerbtn')?.click()
})
