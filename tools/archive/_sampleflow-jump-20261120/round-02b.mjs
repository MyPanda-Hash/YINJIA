// round-02b — 生产复现（精确选择器）:点单号 / 点行;记录 URL、点击、控制台、XHR
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('sampleflow jump prod')
const page = task.page('p1')

const INSTRUMENT = `
window.__errs = window.__errs || []; window.__clicks = window.__clicks || []; window.__reqs = window.__reqs || [];
try {
  if (!window.__instrHooked) {
    window.__instrHooked = 1;
    const oe = console.error, ow = console.warn;
    console.error = function () { window.__errs.push({ t: 'error', m: [...arguments].map(String).join(' ').slice(0, 500) }); return oe.apply(console, arguments) };
    console.warn = function () { window.__errs.push({ t: 'warn', m: [...arguments].map(String).join(' ').slice(0, 500) }); return ow.apply(console, arguments) };
    window.addEventListener('error', function (e) { window.__errs.push({ t: 'uncaught', m: String(e.message || e.error || '').slice(0, 500) }) });
    window.addEventListener('unhandledrejection', function (e) { window.__errs.push({ t: 'reject', m: String((e.reason && (e.reason.stack || e.reason.message)) || e.reason || '').slice(0, 500) }) });
    document.addEventListener('click', function (e) {
      const el = e.target || {};
      const row = el.closest && el.closest('.el-table__row');
      window.__clicks.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 80), text: String(el.innerText || '').trim().slice(0, 40), row: row ? Array.from(row.cells).map(c => c.innerText.trim()).slice(0, 2).join(' | ') : '' });
    }, true);
    const of = window.fetch;
    window.fetch = function (u) { window.__reqs.push({ k: 'fetch', u: String(u).slice(0, 200) }); return of.apply(this, arguments) };
    const ox = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) { window.__reqs.push({ k: 'xhr', m, u: String(u).slice(0, 200) }); return ox.apply(this, arguments) };
  }
} catch (e) {}
`;

await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4000)
const base = await page.evaluate(() => ({
  url: location.href,
  rows: document.querySelectorAll('.el-table__row').length,
  firstRow: (() => { const r = document.querySelector('.el-table__row'); return r ? Array.from(r.cells).map(c => c.innerText.trim()).slice(0, 3) : null })(),
}))
console.log('BASE ' + JSON.stringify(base, null, 2))
await page.evaluate(INSTRUMENT)

// ① 点第一张单的单号
await page.click('.el-table__row:nth-child(1) .sfl-no')
await page.waitForTimeout(3000)
const afterLink = await page.evaluate(() => ({
  url: location.href,
  clicks: (window.__clicks || []).slice(-3),
  errs: (window.__errs || []).slice(-8),
  reqs: (window.__reqs || []).slice(-8),
  body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
}))
console.log('AFTER-LINK-CLICK ' + JSON.stringify(afterLink, null, 2))
await page.screenshot({ path: OUT + '/round-02b-after-link-click.png' })

// 回列表，点行中间（客户名称列）
await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4000)
await page.evaluate(INSTRUMENT)
await page.click('.el-table__row:nth-child(1) td:nth-child(2)')
await page.waitForTimeout(3000)
const afterRow = await page.evaluate(() => ({
  url: location.href,
  clicks: (window.__clicks || []).slice(-3),
  errs: (window.__errs || []).slice(-8),
  reqs: (window.__reqs || []).slice(-8),
  body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
}))
console.log('AFTER-ROW-CLICK ' + JSON.stringify(afterRow, null, 2))
await page.screenshot({ path: OUT + '/round-02b-after-row-click.png' })
await task.finish({ keep: [] })
