/**
 * e2e-print-group.mjs —— 销售出库「生成出厂检验报告」并入「打印」下拉 验证(2026-11-01 09:46)
 *  ① 工具栏不再有独立「生成出厂检验报告」按钮;「打印」组下拉里有它
 *  ② 点它 → 打开勾选弹窗(与之前一致)
 *  截图留档: oqc-print-group-1-dropdown.png / -2-dialog.png
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const OUT_NO = process.argv[3] || 'XSCK-2026-11-99001'
const FACTORY = 'YJ_TEST'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json()
const token = login?.data?.token
const user = login?.data?.user

const shot = async (s, name) => {
  const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (!r?.result?.data) return console.log('[shot][FAIL]', name)
  await fs.writeFile(HERE + name, Buffer.from(r.result.data, 'base64'))
  console.log('[shot]', name)
}

const s = await launch({ port: 9489 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: '${FACTORY}', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN'); return 1
  })()`)
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/SALE_OUT?docNo=' + OUT_NO)}; location.reload(); return 1 })()`)
  await sleep(9000)

  const before = await s.evaluate(`(() => {
    const groups = [...document.querySelectorAll('.tb-group')].map(g => ({
      main: (g.querySelector('.tb-main')?.textContent || '').trim(),
      hasCaret: !!g.querySelector('.tb-caret'),
    }))
    return { groups, standalone: groups.some(g => g.main === '生成出厂检验报告') }
  })()`)
  console.log('[before]', JSON.stringify(before))

  // 打开「打印」下拉
  const opened = await s.evaluate(`(() => {
    const g = [...document.querySelectorAll('.tb-group')].find(x => (x.querySelector('.tb-main')?.textContent || '').trim() === '打印')
    if (!g) return 'no-print-group'
    const caret = g.querySelector('.tb-caret')
    if (!caret) return 'no-caret'
    caret.click(); return 'caret-clicked'
  })()`)
  console.log('[open-print]', opened)
  await sleep(800)
  const menu = await s.evaluate(`(() => {
    const groups = [...document.querySelectorAll('.tb-group')]
    const g = groups.find(x => (x.querySelector('.tb-main')?.textContent || '').trim() === '打印')
    const items = g ? [...g.querySelectorAll('.tb-menu .ctx-item')].map(x => (x.textContent || '').trim()) : []
    return { items, allCtx: [...document.querySelectorAll('.tb-menu .ctx-item')].map(x => (x.textContent || '').trim()) }
  })()`)
  console.log('[print-menu]', JSON.stringify(menu))
  await shot(s, 'oqc-print-group-1-dropdown.png')

  // 点下拉里的「生成出厂检验报告」
  const clicked = await s.evaluate(`(() => {
    const g = [...document.querySelectorAll('.tb-group')].find(x => (x.querySelector('.tb-main')?.textContent || '').trim() === '打印')
    const item = [...(g ? g.querySelectorAll('.tb-menu .ctx-item') : [])].find(x => (x.textContent || '').trim() === '生成出厂检验报告')
    if (!item) return 'no-item'
    item.click(); return 'clicked'
  })()`)
  console.log('[click-item]', clicked)
  await sleep(3500)
  const dlg = await s.evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].filter(x => { const ov = x.closest('.el-overlay'); return ov ? getComputedStyle(ov).display !== 'none' : false }).pop()
    if (!d) return { open: false }
    return {
      open: true,
      title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(),
      rows: [...d.querySelectorAll('.el-table__body tr')].length,
      footer: [...d.querySelectorAll('button')].map(b => (b.textContent || '').trim()).filter(Boolean),
    }
  })()`)
  console.log('[dialog]', JSON.stringify(dlg))
  await shot(s, 'oqc-print-group-2-dialog.png')
  // 取消关闭,不生成
  await s.evaluate(`(() => { const d = [...document.querySelectorAll('.el-dialog')].filter(x => { const ov = x.closest('.el-overlay'); return ov ? getComputedStyle(ov).display !== 'none' : false }).pop(); if (d) { const b = [...d.querySelectorAll('button')].find(x => (x.textContent || '').trim() === '取消'); if (b) b.click() } return 1 })()`)
  await sleep(500)
  await s.close?.()
} finally { process.exit(0) }
