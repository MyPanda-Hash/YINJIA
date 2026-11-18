/**
 * round-10:8090(打包版 = 部署产物)上也确认一遍新前端已生效:
 * 打开「扫码混料」列表 → 进明细 → 看标题「混料单」与抬头「上次混料单」。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 30000 })
await page.waitForTimeout(4000)
const list = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  groups: [...document.querySelectorAll('.mm-grp-head')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  hasQueryBlock: !!document.querySelector('input[placeholder*="工单号"]'),
  entryChunk: [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => /index-/.test(s)).slice(-1)[0] || '',
}))
console.log('== 8090 列表页 ==')
console.log(JSON.stringify(list, null, 2))

await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(3000)
const doc = await page.evaluate(() => ({
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.mp-line')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  submitDisabled: (() => { const b = document.querySelector('.mp-foot button'); return b ? !!b.disabled : null })(),
}))
console.log('== 8090 明细页 ==')
console.log(JSON.stringify(doc, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-10-8090-doc.png' })
