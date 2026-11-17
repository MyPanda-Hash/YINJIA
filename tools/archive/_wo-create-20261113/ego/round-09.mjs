// round-09：搜出界面新建的临时工单 → 校验工单类型列 → 勾选行 → 物料清单弹窗（来源=临时工单 + 7 行）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

async function search(no) {
  await page.evaluate((v) => {
    const inp = document.querySelector('input[placeholder="输入查询条件..."]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, v)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
  }, no)
  await sleep(300)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.wol-query button')].find((b) => (b.textContent || '').trim() === '查找')
    btn?.click()
  })
  await sleep(3200)
  return page.evaluate(() => {
    const ths = [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim())
    return [...document.querySelectorAll('.wol-table .el-table__body tr')].map((tr) => {
      const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
      const o = {}
      ths.forEach((h, i) => { if (h) o[h] = tds[i] })
      return o
    })
  })
}
const rows = await search('GD-2026-11-0012')
console.log('临时工单行=' + JSON.stringify(rows[0] || {}).slice(0, 700))

// 勾选第一行（selection 列 checkbox）
await page.evaluate(() => {
  const tr = document.querySelector('.wol-table .el-table__body tr')
  const box = tr?.querySelector('td .el-checkbox')
  box?.click()
})
await sleep(800)
// 点「物料清单」
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '物料清单')
  btn?.click()
})
await sleep(2500)
const bom = await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('工单号 / 工单行号') && d.getBoundingClientRect().width > 100)
  const d = dlgs[dlgs.length - 1]
  if (!d) return null
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    info: [...d.querySelectorAll('.wol-split-row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()),
    headers: [...d.querySelectorAll('.el-table th')].map((x) => (x.textContent || '').trim()),
    rows: [...d.querySelectorAll('.el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)),
    empty: (d.querySelector('.wol-split-tip') || {}).textContent || '',
  }
})
console.log('物料清单弹窗=' + JSON.stringify(bom, null, 1).slice(0, 2200))
console.log('pageerrors=' + JSON.stringify(errors))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r09-bom-dialog.png' })
