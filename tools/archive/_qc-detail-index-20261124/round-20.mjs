// round-20 — rebase 后复核:明细表两个单号列可点 + 已作废/不存在提示 + 上游出货检验明细表链接未受影响
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc detail index verify after rebase')
const page = task.page('p1')

await page.goto(BASE + '/#/login', { timeout: 120000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.reload({ timeout: 120000 })
await page.waitForTimeout(2500)
await page.fill('.login-form input[autocomplete="username"]', 'admin')
await page.fill('.login-form input[type="password"]', '123456')
const sel = await page.evaluate(() => {
  const el = document.querySelector('.login-form .el-select')
  return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
})
if (!sel || sel.includes('请选择')) {
  await page.click('.login-form .el-select')
  await page.waitForTimeout(500)
  await page.click('.el-select-dropdown__item')
  await page.waitForTimeout(300)
}
await page.click('.login-submit')
await page.waitForTimeout(6000)

// ① 明细表:两个单号列都是 .doc-no-link
await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 120000 })
await page.waitForTimeout(7000)
const dump = await page.evaluate(() => ({
  url: location.href,
  links: [...document.querySelectorAll('.doc-no-link')].slice(0, 6).map((e) => e.innerText.trim()),
  count: document.querySelectorAll('.doc-no-link').length,
}))
console.log('① 明细表链接 = ' + JSON.stringify(dump))
await page.screenshot({ path: OUT + '/round-20-detail.png' })

// ② 点「来料检验单号」
const no = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.doc-no-link')].find((e) => /^IJ-/.test(e.innerText.trim()))
  if (!el) return ''
  const v = el.innerText.trim()
  el.click()
  return v
})
await page.waitForTimeout(6000)
console.log('② 点 ' + no + ' → ' + JSON.stringify(await page.evaluate(() => ({
  url: location.href,
  doc: (document.body.innerText.match(/单据：([^\s]+)/) || ['', ''])[1],
}))))

// ③ 已作废深链提示
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-10-0036', { timeout: 120000 })
const seen = new Set()
const end = Date.now() + 6000
while (Date.now() < end) {
  const now = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
  now.forEach((m) => seen.add(m))
  await page.waitForTimeout(150)
}
console.log('③ 已作废提示 = ' + JSON.stringify([...seen]))

// ④ 上游「出货检验明细表」链接不受影响(能打开、有 .doc-no-link 即算通过;无权限/无数据则跳过)
await page.goto(BASE + '/#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 120000 })
await page.waitForTimeout(7000)
console.log('④ 出货检验明细表 = ' + JSON.stringify(await page.evaluate(() => ({
  url: location.href,
  bodyHas: document.body.innerText.includes('出货检验'),
  links: document.querySelectorAll('.doc-no-link').length,
}))))
