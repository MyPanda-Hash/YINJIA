// round-02 — 生产复现：样品进度跟踪 → 点单号 / 点行，观察 URL、控制台、网络、被守卫拦截
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('sampleflow jump prod')
const page = task.page('p1')

// 页面脚本前注入：控制台错误 / 未捕获异常 / 点击目标 / history 变化 全部落 window
const INSTRUMENT = `
window.__errs = []; window.__clicks = [];
try {
  const oe = console.error, ow = console.warn;
  console.error = function () { window.__errs.push({ t: 'error', m: [...arguments].map(String).join(' ').slice(0, 500) }); return oe.apply(console, arguments) };
  console.warn = function () { window.__errs.push({ t: 'warn', m: [...arguments].map(String).join(' ').slice(0, 500) }); return ow.apply(console, arguments) };
} catch (e) {}
window.addEventListener('error', function (e) { window.__errs.push({ t: 'uncaught', m: String(e.message || e.error || '').slice(0, 500) }) });
window.addEventListener('unhandledrejection', function (e) { window.__errs.push({ t: 'reject', m: String((e.reason && (e.reason.stack || e.reason.message)) || e.reason || '').slice(0, 500) }) });
document.addEventListener('click', function (e) {
  const el = e.target;
  const row = el && el.closest && el.closest('.el-table__row');
  window.__clicks.push({ tag: el && el.tagName, cls: el && el.className && String(el.className).slice(0, 80), text: (el && el.innerText || '').trim().slice(0, 40), row: row ? Array.from(row.cells).map(c => c.innerText.trim()).slice(0, 2).join(' | ') : '' });
}, true);
`;

await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4000)
const base = await page.evaluate(() => ({
  url: location.href,
  rows: document.querySelectorAll('.el-table__row').length,
  links: document.querySelectorAll('.sfl-no').length,
  firstRow: (() => { const r = document.querySelector('.el-table__row'); return r ? Array.from(r.cells).map(c => c.innerText.trim()).slice(0, 4) : null })(),
  firstLink: (() => { const a = document.querySelector('.sfl-no'); return a ? a.innerText.trim() : null })(),
  bodyHead: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('BASE ' + JSON.stringify(base, null, 2))
await page.screenshot({ path: OUT + '/round-02-before.png' })

// 装探针（当前文档有效；本页是 SPA，跳转不重载也能记录）
await page.evaluate(INSTRUMENT)

// ① 点单号
await page.click('.sfl-no')
await page.waitForTimeout(2500)
const afterLink = await page.evaluate(() => ({
  url: location.href,
  clickCount: window.__clicks && window.__clicks.length,
  lastClicks: (window.__clicks || []).slice(-4),
  errs: (window.__errs || []).slice(-10),
  body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260),
}))
console.log('AFTER-LINK-CLICK ' + JSON.stringify(afterLink, null, 2))
await page.screenshot({ path: OUT + '/round-02-after-link-click.png' })

// 回列表，点行中间（客户名称列）
await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4000)
const rowCellSel = await page.evaluate(() => {
  const r = document.querySelector('.el-table__row')
  return r ? r.querySelectorAll('td')[1] ? 'td:nth-child(2)' : '' : ''
})
console.log('row cell selector: ' + rowCellSel)
await page.evaluate(INSTRUMENT)
await page.click('.el-table__row td:nth-child(2)')
await page.waitForTimeout(2500)
const afterRow = await page.evaluate(() => ({
  url: location.href,
  clickCount: window.__clicks && window.__clicks.length,
  lastClicks: (window.__clicks || []).slice(-4),
  errs: (window.__errs || []).slice(-10),
  body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260),
}))
console.log('AFTER-ROW-CLICK ' + JSON.stringify(afterRow, null, 2))
await page.screenshot({ path: OUT + '/round-02-after-row-click.png' })
await task.finish({ keep: [] })
