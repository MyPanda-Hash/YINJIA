/**
 * shot-compare.mjs —— 对比「首件检验单」与「出厂检验报告」两个面板的呈现形式(2026-11-01 第二轮)
 * 用法: node shot-compare.mjs [base] [factory]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const FACTORY = process.argv[3] || 'YJ_TEST'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
if (!token) { console.log('登录失败'); process.exit(1) }

const shot = async (s, name) => {
  const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (!r?.result?.data) return console.log('[shot][FAIL]', name)
  await fs.writeFile(HERE + name, Buffer.from(r.result.data, 'base64'))
  console.log('[shot]', name)
}

const s = await launch({ port: 9471 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: '${FACTORY}', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN')
    return 'ok'
  })()`)
  for (const [panel, no, name] of [
    ['QC_FIRST_INSP', 'SJ-2026-10-0160', 'cmp-first-insp.png'],
    ['QC_OQC_REPORT', 'OQC-2026-11-0003', 'cmp-oqc-report.png'],
  ]) {
    await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/' + panel + '?docNo=' + no)}; location.reload(); return 1 })()`)
    await sleep(9000)
    const st = await s.evaluate(`(() => {
      const txt = (el) => (el?.textContent || '').trim()
      const paper = document.querySelector('.approval-layout')
      const cls = [...(paper ? paper.querySelectorAll('*') : [])].map(x => x.className).filter(c => typeof c === 'string').flatMap(c => c.split(' ')).filter(c => /sheet|record|paper/.test(c))
      return {
        hash: location.hash,
        isApprovalLayout: !!paper,
        paperClasses: [...new Set(cls)].slice(0, 30),
        sideBtns: [...document.querySelectorAll('.as-side-btn')].map(txt).slice(0, 30),
        toolbarGroups: [...document.querySelectorAll('.tb-group .tb-main')].map(txt),
      }
    })()`)
    console.log('[' + panel + ']', JSON.stringify(st))
    await shot(s, name)
  }
  await s.close?.()
} finally { process.exit(0) }
