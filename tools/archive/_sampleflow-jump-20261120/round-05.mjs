// round-05 — 生产：逐个样品单直接开 ?focus= 深链，记录"实际显示的是哪张单"
const fs = await import('node:fs/promises')
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const raw = JSON.parse(await fs.readFile('/tmp/sf-RD_SAMPLE_EXT.json', 'utf8'))
const docs = raw.data.map((r) => r['单据编号'])
const task = await taskSpace('sampleflow jump prod')
const page = await task.newPage()

const rows = []
for (const no of docs) {
  await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_EXT?focus=' + encodeURIComponent(no), { timeout: 90000 })
  await page.waitForTimeout(4500)
  const got = await page.evaluate(() => {
    const txt = document.body.innerText.replace(/\s+/g, ' ')
    const m = txt.match(/样品单编号[：:]\s*([^\s]+)/)
    const inputs = Array.from(document.querySelectorAll('input')).map(i => (i.value || '').trim()).filter(Boolean)
    const pos = (txt.match(/第\s*(\d+)\s*\/\s*(\d+)/) || []).slice(1)
    return { url: location.href, bodyNo: m ? m[1] : '', firstInput: inputs[0] || '', pos }
  })
  const shown = got.bodyNo || got.firstInput
  rows.push({ want: no, shown, same: shown === no, url: got.url, pos: got.pos.join('/') })
  console.log(`${shown === no ? 'OK  ' : 'MISS'} want=${no} shown=${shown} pos=${got.pos.join('/')}`)
}
await fs.writeFile(OUT + '/round-05-focus-matrix.json', JSON.stringify(rows, null, 2))
console.log('SUMMARY ' + JSON.stringify({ total: rows.length, ok: rows.filter(r => r.same).length, miss: rows.filter(r => !r.same).length }))
await task.finish({ keep: [] })
