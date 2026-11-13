// round-03:诊断 5174 页面状态(登录/接口是否通/面板配置能否取到)
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')

const st = await page.evaluate(() => {
  const keys = Object.keys(localStorage)
  return {
    hash: location.hash,
    hasLoginInput: !![...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('账号')),
    ls: keys.slice(0, 20),
    tokenLike: keys.filter((k) => /token|user|auth/i.test(k)).map((k) => k + '=' + String(localStorage.getItem(k)).slice(0, 60)),
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 700),
  }
})
console.log('STATE ' + JSON.stringify(st, null, 2))

const api = await page.evaluate(async () => {
  const out = {}
  try {
    const r = await window.fetch('/api/px/getPanelConfig?panelCode=WO_REPORT_LIST', { headers: { Accept: 'application/json' } })
    const txt = await r.text()
    out.config = { status: r.status, body: txt.slice(0, 500) }
  } catch (e) { out.config = { err: String(e) } }
  try {
    const r2 = await window.fetch('/api/px/queryFormDataList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelCode: 'WO_REPORT_LIST', condition: {}, pageNo: 1, pageSize: 3 }),
    })
    const t2 = await r2.text()
    out.query = { status: r2.status, body: t2.slice(0, 700) }
  } catch (e) { out.query = { err: String(e) } }
  return out
})
console.log('API ' + JSON.stringify(api, null, 2))

await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-03.png' })
console.log('DONE round-03')
