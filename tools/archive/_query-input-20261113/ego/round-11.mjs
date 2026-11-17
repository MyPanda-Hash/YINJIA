// round-11:i18n(English 下的查询区文案) + 其它面板未被波及(完工明细仍是原只读控件)
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')

// ① 切 English(点顶部语言按钮 → 选 English)
await page.goto('http://localhost:5174/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await page.waitForTimeout(8000)
const langClick = await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, .lang-switch, .el-dropdown, span, div')]
    .find((x) => (x.textContent || '').trim() === '中' && x.offsetParent !== null)
  if (el) { el.click(); return 'clicked' }
  return 'no-lang-btn'
})
console.log('LANG_CLICK ' + langClick)
await page.waitForTimeout(1200)
const langPick = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item, li, .lang-item')]
    .filter((x) => /English/.test(x.textContent || ''))
  const t = items[0]
  if (t) { t.click(); return (t.textContent || '').trim() }
  return null
})
console.log('LANG_PICK ' + JSON.stringify(langPick))
await page.waitForTimeout(4000)
const en = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.fields.udl-fields .field')]
  const rows = fields.map((f) => ({
    label: (f.querySelector('label')?.textContent || '').trim(),
    autocomplete: !!f.querySelector('.el-autocomplete'),
    placeholder: f.querySelector('input')?.placeholder || '',
  }))
  return {
    rows: rows.filter((r) => r.autocomplete),
    btnTitle: (() => {
      const f = fields.find((x) => (x.querySelector('label')?.textContent || '').trim() === '产品编码')
      return f ? [...f.querySelectorAll('button')].map((b) => (b.title || '').trim()) : []
    })(),
    bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
  }
})
console.log('EN ' + JSON.stringify(en, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-11-en.png' })

// ② 切回中文(若上面点开了语言列表,用同样方式选简体中文)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, span, div')].find((x) => /^(English|EN)$/i.test((x.textContent || '').trim()) && x.offsetParent !== null)
  if (el) el.click()
})
await page.waitForTimeout(1200)
const back = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item, li')].filter((x) => /简体中文|中文/.test(x.textContent || ''))
  if (items[0]) { items[0].click(); return (items[0].textContent || '').trim() }
  return null
})
console.log('BACK_ZH ' + JSON.stringify(back))
await page.waitForTimeout(3000)

// ③ 其它面板未被波及:完工明细(WO_COMPLETION_LIST)的参照字段应仍是只读 + 放大镜
await page.goto('http://localhost:5174/#/panelx/list/WO_COMPLETION_LIST', { timeout: 90000 })
await page.waitForTimeout(8000)
const other = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.fields.udl-fields .field')]
  const refs = fields.filter((f) => f.querySelector('button[title*="参照"], button[title*="打开参照"]')).map((f) => {
    const inp = f.querySelector('input')
    return {
      label: (f.querySelector('label')?.textContent || '').trim(),
      autocomplete: !!f.querySelector('.el-autocomplete'),
      readonly: inp ? inp.readOnly : null,
      placeholder: inp ? inp.placeholder : '',
    }
  })
  return { fieldCount: fields.length, refs, rows: document.querySelectorAll('.el-table__body tbody tr').length }
})
console.log('OTHER_PANEL ' + JSON.stringify(other, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-11-other-panel.png' })
console.log('DONE round-11')
