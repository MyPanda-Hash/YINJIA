/**
 * e2e-print-i18n.mjs —— 出厂检验报告 收尾复核(2026-11-01)
 *  ① QC_OQC_REPORT 面板：工具栏有「打印」；点它 → 打开服务端受控表单 PDF(blob:)
 *  ② 切 en：销售出库「生成出厂检验报告」入口弹窗文案全部英文(验证 i18n)
 *
 * 用法: node e2e-print-i18n.mjs [base] [factory] [oqcNo] [outNo]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const FACTORY = process.argv[3] || 'YJ_TEST'
const OQC_NO = process.argv[4] || 'OQC-2026-11-0003'
const OUT_NO = process.argv[5] || 'XSCK-2026-11-99001'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const shot = async (s, name) => {
  const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (!r?.result?.data) return console.log('[shot][FAIL]', name)
  await fs.writeFile(HERE + name, Buffer.from(r.result.data, 'base64'))
  console.log('[shot]', name)
}

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
if (!token) { console.log('登录失败'); process.exit(1) }

const setAuth = async (s) => s.evaluate(`(() => {
  localStorage.setItem('mes_token', ${JSON.stringify(token)})
  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
  localStorage.setItem('mes_factory', JSON.stringify({ code: '${FACTORY}', name: 'YINJIA-MES·测试库' }))
  return 'ok'
})()`)

const s = await launch({ port: 9467 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2000)
  await setAuth(s)
  await s.evaluate(`(() => { localStorage.setItem('mes_locale', 'zh-CN'); location.href = ${JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + encodeURIComponent(OQC_NO))}; location.reload(); return 1 })()`)
  await sleep(9000)

  // ---- ① 打印按钮 → 服务端 PDF ----
  const st = await s.evaluate(`(() => {
    const txt = (el) => (el?.textContent || '').trim()
    return { url: location.hash, docChip: txt(document.querySelector('.doc-chip')), groups: [...document.querySelectorAll('.tb-group .tb-main')].map(txt) }
  })()`)
  console.log('[report-panel]', JSON.stringify(st))
  await s.evaluate(`(() => { window.__oqcOpened = null; window.open = (u) => { window.__oqcOpened = String(u); return { focus() {}, close() {} } }; return 'hooked' })()`)
  const clicked = await s.evaluate(`(() => {
    const el = [...document.querySelectorAll('.tb-group .tb-main')].find(x => (x.textContent || '').trim() === '打印')
    if (!el) return 'no-print-btn'
    el.click(); return 'clicked'
  })()`)
  await sleep(4500)
  const opened = await s.evaluate(`String(window.__oqcOpened || '')`)
  const msgs = await s.evaluate(`[...document.querySelectorAll('.el-message')].map(x => (x.textContent || '').trim())`)
  console.log('[print]', clicked, '| opened=' + opened.slice(0, 60), '| msgs=' + JSON.stringify(msgs))
  await shot(s, 'e2e-6-print.png')

  // ---- ② en 下的入口弹窗 ----
  await s.evaluate(`(() => { localStorage.setItem('mes_locale', 'en'); location.href = ${JSON.stringify(BASE + '/#/panelx/list/SALE_OUT?docNo=' + encodeURIComponent(OUT_NO))}; location.reload(); return 1 })()`)
  await sleep(9000)
  const clicked2 = await s.evaluate(`(() => {
    const el = [...document.querySelectorAll('.tb-group .tb-main')].find(x => (x.textContent || '').includes('Create Factory Inspection Report'))
      || [...document.querySelectorAll('.tb-group .tb-main')].find(x => (x.textContent || '').includes('生成出厂检验报告'))
    if (!el) return 'no-btn:' + [...document.querySelectorAll('.tb-group .tb-main')].map(x => (x.textContent || '').trim()).join('/')
    el.click(); return 'clicked:' + (el.textContent || '').trim()
  })()`)
  console.log('[en click]', clicked2)
  await sleep(4000)
  const dlg = await s.evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => x.offsetParent !== null)
    if (!d) return { open: false }
    const heads = [...d.querySelectorAll('.el-table__header th')].map(x => (x.textContent || '').trim()).filter(Boolean)
    return {
      open: true,
      title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(),
      tips: [...d.querySelectorAll('.col-pref-tip, .oqc-warn')].map(x => (x.textContent || '').trim()),
      heads,
      footer: [...d.querySelectorAll('button')].map(x => (x.textContent || '').trim()).filter(Boolean),
      hasChinese: /[\\u4e00-\\u9fa5]/.test(d.innerText),
    }
  })()`)
  console.log('[en dialog]', JSON.stringify(dlg, null, 1))
  await shot(s, 'e2e-7-en-dialog.png')
  // 复位语言
  await s.evaluate(`(() => { localStorage.setItem('mes_locale', 'zh-CN'); return 1 })()`)
  await s.close?.()
} finally { process.exit(0) }
