/* round-01:首次打开两个新面板(测试账套 YJ_TEST)——只读看版面 + DOM 取证 */
const task = await taskSpace('sample-insp-20261115')
const page = task.page('p1')
const BASE = 'http://localhost:5173'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

// 登录到测试账套:直接调接口拿 token 写 localStorage,再刷新(避免 UI 下拉选厂的不确定性)
async function loginTest() {
  const r = await page.evaluate(async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
    })
    const j = await res.json()
    if (!j?.data?.token) return { ok: false, msg: JSON.stringify(j).slice(0, 300) }
    localStorage.setItem('mes_token', j.data.token)
    localStorage.setItem('mes_user', JSON.stringify(j.data.user))
    localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
    return { ok: true, token: j.data.token.slice(0, 24), user: j.data.user.userName, factory: j.data.user.factory }
  })
  console.log('login:', JSON.stringify(r))
  return r.ok
}

await page.goto(BASE + '/#/login', { timeout: 60000 })
await page.waitForTimeout(1500)
if (!(await page.evaluate(() => !!localStorage.getItem('mes_token')))) {
  await loginTest()
}
await restoreWindow()

// ① 检验委托单面板(新建一张空白草稿,看纸面)
await page.goto(BASE + '/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(3500)
await restoreWindow()
const info1 = await page.evaluate(() => ({
  hash: location.hash,
  hasSheet: !!document.querySelector('.ic-sheet'),
  sheetText: (document.querySelector('.ic-sheet')?.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
  titles: [...document.querySelectorAll('.ic-title-1,.ic-title-2')].map((e) => e.textContent.trim()),
  rows: document.querySelectorAll('.ic-table tr').length,
  sideBtns: [...document.querySelectorAll('.approval-side .as-side-btn')].map((e) => (e.textContent || '').trim()).slice(0, 40),
  panelName: document.querySelector('.panelx-list .panel-title')?.textContent || '',
}))
console.log('INSP_COMMISSION:', JSON.stringify(info1, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/sample-insp-20261115/round-01-commission-empty.png' })

// ② 送样登记表面板(档案目录,应有 44 行)
await page.goto(BASE + '/#/panelx/list/SAMPLE_REG', { timeout: 60000 })
await page.waitForTimeout(3000)
await restoreWindow()
const info2 = await page.evaluate(() => ({
  hash: location.hash,
  gridRows: document.querySelectorAll('.el-table__body tr').length,
  firstRows: [...document.querySelectorAll('.el-table__body tr')].slice(0, 3).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120)),
  total: (document.querySelector('.el-pagination__total')?.textContent || '').trim(),
}))
console.log('SAMPLE_REG:', JSON.stringify(info2, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/sample-insp-20261115/round-01-catalog.png' })

await task.finish({ keep: true })
