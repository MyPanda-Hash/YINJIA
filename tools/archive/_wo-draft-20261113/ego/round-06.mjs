// round-06：草稿箱「继续编辑」（临时草稿）→ 提交 → 列表临时工单 → 物料清单弹窗（来源=临时工单）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-draft-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

// 草稿箱开着 → 继续编辑第一行
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('草稿箱') && x.getBoundingClientRect().width > 100)
  const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '继续编辑')
  btn?.click()
})
await sleep(3800)
const state = await page.evaluate(() => ({
  hash: location.hash,
  head: (document.querySelector('.wop-head') || {}).textContent?.replace(/\s+/g, ' ').trim(),
  rows: document.querySelectorAll('.wop-page .el-table__body tr').length,
}))
console.log('继续编辑=' + JSON.stringify(state))
// 提交
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === '提交生成工单')
  btn?.click()
})
let toasts = []
for (let i = 0; i < 30; i++) {
  await sleep(400)
  toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
  const hash = await page.evaluate(() => location.hash)
  if (toasts.some((x) => x.includes('GD-')) || hash.includes('workOrderList')) break
}
await sleep(3800)
const after = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim())
  const rows = [...document.querySelectorAll('.wol-table .el-table__body tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    const o = {}
    ths.forEach((h, i) => { if (h) o[h] = tds[i] })
    return o
  })
  return {
    hash: location.hash,
    query: location.href,
    toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean),
    rows: rows.slice(0, 3),
    badge: (() => {
      const b = [...document.querySelectorAll('.wol-btns button')].find((x) => (x.textContent || '').includes('草稿箱'))
      return b ? (b.textContent || '').replace(/\s+/g, ' ').trim() : ''
    })(),
  }
})
console.log('提交后=' + JSON.stringify(after, null, 1).slice(0, 2200))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r06-temp-submitted.png' })

// 物料清单弹窗：勾选第一行 → 物料清单
await page.evaluate(() => {
  const tr = document.querySelector('.wol-table .el-table__body tr')
  tr?.querySelector('td .el-checkbox')?.click()
})
await sleep(800)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '物料清单')
  btn?.click()
})
await sleep(2500)
const bom = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('工单号 / 工单行号') && x.getBoundingClientRect().width > 100)
  if (!d) return null
  return {
    info: [...d.querySelectorAll('.wol-split-row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()),
    rows: [...d.querySelectorAll('.el-table__body tr')].length,
  }
})
console.log('物料清单=' + JSON.stringify(bom))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r06-temp-bom.png' })
console.log('pageerrors=' + JSON.stringify(errors))
