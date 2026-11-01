/** e2e-hygiene-blank-shot.mjs —— 卫生安全结果列「未填=空白」截图(2026-11-01 09:24 补正验证) */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = 'http://127.0.0.1:8090'
const DOC = process.argv[2] || 'OQC-2026-11-0003'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = login?.data?.token
const user = login?.data?.user

const s = await launch({ port: 9487 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN'); return 1
  })()`)
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + DOC)}; location.reload(); return 1 })()`)
  await sleep(9000)
  const st = await s.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.oqc-hygiene-input input')]
    const t = document.querySelector('.oqc-hygiene')
    if (t) t.scrollIntoView({ block: 'center' })
    return { n: inputs.length, placeholders: inputs.map(x => x.getAttribute('placeholder')), vals: inputs.map(x => x.value) }
  })()`)
  console.log('[state]', JSON.stringify(st))
  await sleep(1200)
  const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (r?.result?.data) { await fs.writeFile(HERE + 'e2e-hygiene-blank.png', Buffer.from(r.result.data, 'base64')); console.log('[shot] e2e-hygiene-blank.png') }
  await s.close?.()
} finally { process.exit(0) }
