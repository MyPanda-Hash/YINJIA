// round-07：英文界面走查（新增整页 / 保存草稿 / 草稿箱 / 草稿号）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-draft-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(4500)
const enList = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('.wol-btns button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 8),
  hasTypeHeader: [...document.querySelectorAll('.wol-table th')].some((th) => (th.textContent || '').trim() === 'Work Order Type'),
}))
console.log('英文列表=' + JSON.stringify(enList))
// 打开新增页
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === 'New')
  btn?.click()
})
await sleep(3800)
const enPage = await page.evaluate(() => {
  const root = document.querySelector('.wop-page')
  if (!root) return { ok: false }
  return {
    ok: true,
    title: (root.querySelector('.wop-title') || {}).textContent || '',
    tabs: [...root.querySelectorAll('.wop-tabs .el-tabs__item')].map((x) => (x.textContent || '').trim()),
    labels: [...root.querySelectorAll('.wop-form .el-form-item__label')].map((x) => (x.textContent || '').trim()).slice(0, 12),
    footer: [...root.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter((t) => ['Save Draft', 'Submit & Create', 'Back to list'].includes(t)),
  }
})
console.log('英文新增页=' + JSON.stringify(enPage))
// 空表单点保存草稿 -> 英文提示
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === 'Save Draft')
  btn?.click()
})
await sleep(1500)
const warn = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
console.log('保存草稿校验提示=' + JSON.stringify(warn))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r07-en-page.png' })
// 回列表 → 草稿箱（空态英文）
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === 'Back to list')
  btn?.click()
})
await sleep(3500)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').includes('Draft Box') || (b.textContent || '').includes('草稿箱'))
  btn?.click()
})
await sleep(2200)
const enBox = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('Draft') && x.getBoundingClientRect().width > 100)
  if (!d) return null
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    headers: [...d.querySelectorAll('.el-table th')].map((x) => (x.textContent || '').trim()),
    empty: (d.querySelector('.el-table__empty-text') || {}).textContent || '',
  }
})
console.log('英文草稿箱=' + JSON.stringify(enBox))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r07-en-draftbox.png' })
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(3000)
console.log('恢复中文=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.wol-btns button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 3))))
console.log('pageerrors=' + JSON.stringify(errors))
