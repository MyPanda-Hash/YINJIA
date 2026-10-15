/* _q-deployed.mjs — 复核 8090 服务的前端产物是否含本次改动。 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
;(async () => {
  const html = await (await fetch(BASE + '/')).text()
  const chunks = [...html.matchAll(/assets\/[A-Za-z0-9._-]+\.js/g)].map((m) => m[0])
  const uniq = [...new Set(chunks)]
  console.log('首页 chunks:', uniq.length)
  for (const c of uniq) {
    const js = await (await fetch(BASE + '/' + c)).text()
    if (js.includes('Not inspected yet')) console.log('  ✅', c, '含 未检验 -> Not inspected yet')
    if (js.includes('合格数量')) console.log('  ·', c, '含 合格数量 词条')
  }
})().catch((e) => {
  console.error('FAIL', e.message)
  process.exit(1)
})
