const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// ① 电脑端纸面:手机存的那张单(EU-2026-11-0003)应能看到「手机照片」附件条并可点开
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(1000)
await page.goto('http://localhost:5173/#/panelx/list/RD_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(9000)

const probe = await page.evaluate(() => ({
  strips: document.querySelectorAll('.rsp-attach-strip').length,
  stripText: [...document.querySelectorAll('.rsp-attach-strip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  chips: [...document.querySelectorAll('.fac-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  empty: [...document.querySelectorAll('.fac-empty')].map((e) => (e.textContent || '').trim()),
  docNo: [...document.querySelectorAll('.rs-docno, .rsp-docno, .rs-head-no')].map((e) => (e.textContent || '').trim()).slice(0, 4),
  bodyNo: [...document.querySelectorAll('*')].filter((e) => !e.children.length && /EU-2026-11-000/.test(e.textContent || '')).map((e) => e.textContent.trim()).slice(0, 4),
}))
console.log(JSON.stringify(probe, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-16-pc-attach.png' })
