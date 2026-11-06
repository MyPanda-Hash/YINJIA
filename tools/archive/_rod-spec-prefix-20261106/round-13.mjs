// round-13：①核对活体加载的资源 ②删掉我取证时新建的那张空白草稿
const task = await taskSpace('yj-rod-spec')
const page = task.page('p2')
const base = 'http://127.0.0.1:8090'
await page.goto(`${base}/#/panelx/list/RD_MOLD_PROC`, { timeout: 30000 })
await page.waitForTimeout(5000)

const res = await page.evaluate(() => {
  const e = performance.getEntriesByType('resource').map((r) => r.name)
  return {
    total: e.length,
    recordSheet: e.filter((n) => n.includes('RecordSheetPanels')),
    entry: e.filter((n) => n.includes('index-')).slice(0, 3),
    main: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
  }
})
console.log('RES', JSON.stringify(res, null, 1))

// 删除取证用的空白草稿（软删）
const del = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].filter((n) => n.children.length === 0 && (n.innerText || '').trim() === '删除')[0]
  if (!el) return { found: false }
  el.click()
  return { found: true, cls: el.className }
})
await page.waitForTimeout(1200)
const dlg = await page.evaluate(() => ({
  box: (document.querySelector('.el-message-box') || {}).innerText || '',
  btns: [...document.querySelectorAll('.el-message-box button')].map((b) => b.innerText.trim()),
}))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button')].find((x) => /确定|确认|删除/.test(x.innerText))
  if (b) b.click()
})
await page.waitForTimeout(3500)
const after = await page.evaluate(() => ({
  pager: (document.body.innerText.match(/第\s*\d+\s*\/\s*\d+/) || [''])[0],
  msg: [...document.querySelectorAll('.el-message__content')].map((m) => m.innerText.trim()),
}))
console.log('DEL', JSON.stringify({ del, dlg, after }, null, 1))
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-rodspec-20261106/D-after-delete.png' })
