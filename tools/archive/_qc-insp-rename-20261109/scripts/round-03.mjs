// round-03 — 调试语言切换 & 重试英文取证 + 选生产工单按钮定位
const OUT = 'C:/Users/vigna/ego/qc-insp-rename-20261109'
const task = await taskSpace(29)
const page = task.page('p1')

async function state(tag) {
  const s = await page.evaluate(() => ({
    url: location.hash,
    ls: localStorage.getItem('mes_locale'),
    htmlLang: document.documentElement.lang,
    docTitle: document.title,
    tab: [...document.querySelectorAll('.tabsbar .tab')].map((e) => (e.textContent || '').trim()),
    paperTitle: [...document.querySelectorAll('.qr-title')].map((e) => (e.textContent || '').trim()),
    toolbarBtns: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, '')).filter((x) => x && x.length <= 12).slice(0, 30),
  }))
  console.log(tag + ' ' + JSON.stringify(s, null, 2))
  return s
}
await state('S0')

// 方式一:Alt+L 热键循环语言
await page.keyboard.press('Alt+l')
await page.waitForTimeout(2500)
await state('S1_after_altL')
await page.keyboard.press('Alt+l')
await page.waitForTimeout(2500)
await state('S2_after_altL2')

// 方式二:TopBar 语言下拉(若不生效)
const dd = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.factory-name, .topbar .el-dropdown, .el-dropdown')]
  return el.map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6)
})
console.log('DROPDOWNS ' + JSON.stringify(dd, null, 2))
await page.screenshot({ path: OUT + '/r3-locale-try.png' })
console.log('DONE')
