const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

// ① 电脑端同一个面板:手机存的单应出现在列表,且「手机照片」附件条可点开
await page.goto('http://localhost:5173/#/panelx/list/RD_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(3500)
const pc = await page.evaluate(() => ({
  hash: location.hash,
  // 附件条(Header 附件字段 = 手机照片)
  attachStrip: document.querySelector('.attach-strip')?.textContent?.replace(/\s+/g, ' ').trim() || '',
  chips: [...document.querySelectorAll('.fac-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  // 列表里本轮的记录
  hasRow: !!document.body.innerText.match(/EU-2026-11-0003/),
  bodySnippet: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
}))
console.log('pc=' + JSON.stringify(pc, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-14-pc-panel.png' })
