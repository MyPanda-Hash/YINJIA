// round-03 — 生产：点第 5 行（非首行）单号 / 行，确认是否定位到"对应的"那张单
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('sampleflow jump prod')
const page = task.page('p1')

const INSTRUMENT = `
window.__errs = []; window.__clicks = []; window.__navs = []; window.__reqs = [];
try {
  const oe = console.error, ow = console.warn;
  console.error = function () { window.__errs.push({ t: 'error', m: [...arguments].map(String).join(' ').slice(0, 400) }); return oe.apply(console, arguments) };
  console.warn = function () { window.__errs.push({ t: 'warn', m: [...arguments].map(String).join(' ').slice(0, 400) }); return ow.apply(console, arguments) };
  window.addEventListener('error', function (e) { window.__errs.push({ t: 'uncaught', m: String(e.message || '').slice(0, 400) }) });
  window.addEventListener('unhandledrejection', function (e) { window.__errs.push({ t: 'reject', m: String((e.reason && (e.reason.stack || e.reason.message)) || e.reason || '').slice(0, 400) }) });
  document.addEventListener('click', function (e) {
    const el = e.target || {};
    const row = el.closest && el.closest('.el-table__row');
    window.__clicks.push({ text: String(el.innerText || '').trim().slice(0, 40), tag: el.tagName, row: row ? Array.from(row.cells).map(c => c.innerText.trim()).slice(0, 2).join(' | ') : '' });
  }, true);
  const wrap = function (k) {
    const orig = history[k].bind(history);
    history[k] = function (s, t, u) { window.__navs.push({ k: k, url: String(u || ''), at: Date.now() }); return orig(s, t, u) };
  };
  wrap('pushState'); wrap('replaceState');
  window.addEventListener('hashchange', function () { window.__navs.push({ k: 'hashchange', url: location.href }) });
  const of = window.fetch;
  window.fetch = function (u) { window.__reqs.push({ k: 'fetch', u: String(u).slice(0, 160) }); return of.apply(this, arguments) };
  const ox = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { window.__reqs.push({ k: 'xhr', m: m, u: String(u).slice(0, 160) }); return ox.apply(this, arguments) };
} catch (e) {}
`;

await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4500)
await page.evaluate(INSTRUMENT)
const docs = await page.evaluate(() => Array.from(document.querySelectorAll('.sfl-no')).map(a => a.innerText.trim()))
console.log('DOCS ' + JSON.stringify(docs))
const target = docs[4]
console.log('TARGET(row5) ' + target)

// 点第 5 行单号
await page.click('.el-table__row:nth-child(5) .sfl-no')
await page.waitForTimeout(3500)
const r1 = await page.evaluate(() => {
  const sheetTxt = document.body.innerText.replace(/\s+/g, ' ')
  const m = sheetTxt.match(/样品单编号[：:]\s*([^\s]+)/)
  return {
    url: location.href,
    navs: window.__navs,
    clicks: window.__clicks.slice(-3),
    errs: window.__errs.slice(-5),
    shownDocNo: m ? m[1] : '(未读到)',
    activeRow: (() => { const r = document.querySelector('.el-table__row.current-row, .el-table__row.is-current, .el-table__row.active'); return r ? r.innerText.replace(/\s+/g, ' ').slice(0, 120) : '(无高亮行)' })(),
    currentTab: (() => { const t = document.querySelector('.tabs-bar .is-active, .el-tabs__item.is-active, .tabs .active'); return t ? t.innerText.trim() : '(无)' })(),
  }
})
console.log('AFTER-LINK-ROW5 ' + JSON.stringify(r1, null, 2))
await page.screenshot({ path: OUT + '/round-03-after-link-row5.png' })

// 回去点第 5 行的客户名称列
await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4500)
await page.evaluate(INSTRUMENT)
await page.click('.el-table__row:nth-child(5) td:nth-child(2)')
await page.waitForTimeout(3500)
const r2 = await page.evaluate(() => {
  const sheetTxt = document.body.innerText.replace(/\s+/g, ' ')
  const m = sheetTxt.match(/样品单编号[：:]\s*([^\s]+)/)
  return {
    url: location.href,
    navs: window.__navs,
    clicks: window.__clicks.slice(-3),
    errs: window.__errs.slice(-5),
    shownDocNo: m ? m[1] : '(未读到)',
  }
})
console.log('AFTER-ROW5-CLICK ' + JSON.stringify(r2, null, 2))
await page.screenshot({ path: OUT + '/round-03-after-row5-click.png' })
await task.finish({ keep: [] })
