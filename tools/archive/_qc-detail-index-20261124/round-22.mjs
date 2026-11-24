// round-22 — 复核三个落点(会话已登录、模块已热)
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc detail index verify after rebase')
const page = task.page('p1')

async function gotoTab(hash) {
  await page.goto(BASE + '/' + hash, { timeout: 180000 })
  await page.waitForTimeout(6000)
}
async function clickLink(re) {
  return await page.evaluate((src) => {
    const rx = new RegExp(src)
    const el = [...document.querySelectorAll('.doc-no-link')].find((e) => rx.test(e.innerText.trim()))
    if (!el) return ''
    const v = el.innerText.trim()
    el.click()
    return v
  }, re)
}

// ① 来料检验单号 → 来料检验单
await gotoTab('#/panelx/list/QC_INSP_REC_DETAIL')
const a = await clickLink('^IJ-')
await page.waitForTimeout(6000)
console.log('① 点 ' + a + ' → ' + JSON.stringify(await page.evaluate(() => ({ url: location.href, doc: (document.body.innerText.match(/单据：([^\s]+)/) || ['', ''])[1] }))))
await page.screenshot({ path: OUT + '/round-22-jump-insp.png' })

// ② 检验数据记录单号 → 检验数据记录
await gotoTab('#/panelx/list/QC_INSP_REC_DETAIL')
const b = await clickLink('^JYSJ-')
await page.waitForTimeout(6000)
console.log('② 点 ' + b + ' → ' + JSON.stringify(await page.evaluate(() => ({ url: location.href, insp: (document.body.innerText.match(/IJ-\d{4}-\d{2}-\d{4}/) || [''])[0], sheet: document.body.innerText.includes('检验报告') }))))
await page.screenshot({ path: OUT + '/round-22-jump-rec.png' })

// ③ 已作废深链提示
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-10-0036', { timeout: 180000 })
const seen = new Set()
const end = Date.now() + 6000
while (Date.now() < end) {
  const now = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
  now.forEach((m) => seen.add(m))
  await page.waitForTimeout(150)
}
console.log('③ 已作废提示 = ' + JSON.stringify([...seen]))
