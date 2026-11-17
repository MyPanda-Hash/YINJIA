// round-17: 补齐三个必填(币种 / 汇率 / 明细第1行仓库) —— 只填不审,填完把状态读回来。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(400)

// ① 币种:表头 .field 里 label 文本 = 币种 的 el-select
const cur = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.header-fields .field')]
  const f = fields.find((x) => (x.querySelector('label')?.textContent || '').trim() === '币种')
  f?.querySelector('.el-select__wrapper')?.click()
  return !!f
})
console.log('CURRENCY_FIELD ' + cur)
await page.waitForTimeout(900)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((el) => (el.textContent || '').trim()).filter(Boolean))
console.log('CURRENCY_OPTS ' + JSON.stringify(opts.slice(0, 8)))
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item')]
  const it = items.find((el) => (el.textContent || '').trim()) || items[0]
  it?.click()
})
await page.waitForTimeout(700)

// ② 汇率:el-input-number 里的 input
const rate = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.header-fields .field')]
  const f = fields.find((x) => (x.querySelector('label')?.textContent || '').trim() === '汇率')
  const inp = f?.querySelector('input')
  if (!inp) return null
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '1')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
  return inp.value
})
console.log('RATE ' + rate)
await page.waitForTimeout(600)

// ③ 明细第 1 行「仓库」:找表头含「物料编码」的那张表
const detail = await page.evaluate(() => {
  const table = [...document.querySelectorAll('table')].find((t) => {
    const ths = [...t.querySelectorAll('thead th')].map((th) => (th.textContent || '').trim())
    return ths.some((x) => x.startsWith('物料编码')) && ths.some((x) => x.startsWith('仓库'))
  })
  if (!table) return { found: false }
  const ths = [...table.querySelectorAll('thead th')].map((th) => (th.textContent || '').trim())
  const col = ths.findIndex((x) => x.startsWith('仓库'))
  const row = table.querySelector('tbody tr')
  const td = row ? row.querySelectorAll('td')[col] : null
  return {
    found: true,
    col,
    cellHTML: (td?.innerHTML || '').slice(0, 300),
    hasSelect: !!td?.querySelector('.el-select'),
    inputVal: td?.querySelector('input')?.value ?? null,
  }
})
console.log('DETAIL ' + JSON.stringify(detail))

const after = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const fields = [...document.querySelectorAll('.header-fields .field')].map((f) => ({
    label: text(f.querySelector('label')),
    value: f.querySelector('input')?.value ?? text(f.querySelector('.el-select')),
  }))
  return { fields, status: text(document.querySelector('.doc-status')) }
})
console.log('AFTER ' + JSON.stringify(after))
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-17.json', JSON.stringify({ opts, rate, detail, after }, null, 2), 'utf8')
