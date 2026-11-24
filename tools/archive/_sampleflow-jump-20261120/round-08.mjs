// round-08 — 探路：取消单在 ?docNo= / /panelx/form 下能否打开
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const NO = 'admin-2026-11-19-01'
const task = await taskSpace('sampleflow jump prod')
const page = await task.newPage()
const probe = (no) => ({
  url: location.href,
  firstInput: (Array.from(document.querySelectorAll('input')).map((i) => (i.value || '').trim()).filter(Boolean)[0]) || '',
  bodyNo: (() => { const m = document.body.innerText.replace(/\s+/g, ' ').match(/样品单编号[：:]\s*([^\s：:]+)/); return m ? m[1] : '' })(),
  pos: (document.body.innerText.replace(/\s+/g, ' ').match(/第\s*(\d+)\s*\/\s*(\d+)/) || []).slice(1).join('/'),
  hasNoText: document.body.innerText.includes(no),
  body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260),
})

await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_EXT?docNo=' + encodeURIComponent(NO), { timeout: 90000 })
await page.waitForTimeout(5000)
console.log('DOCNO ' + JSON.stringify(await page.evaluate(probe, NO), null, 2))
await page.screenshot({ path: OUT + '/round-08-docno-canceled.png' })

await page.goto(BASE + '/#/panelx/form/RD_SAMPLE_EXT?code=' + encodeURIComponent(NO), { timeout: 90000 })
await page.waitForTimeout(5000)
console.log('FORM ' + JSON.stringify(await page.evaluate(probe, NO), null, 2))
await page.screenshot({ path: OUT + '/round-08-form-canceled.png' })
await task.finish({ keep: [] })
