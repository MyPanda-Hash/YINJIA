/**
 * shot-print-preview.mjs —— 出纸版式截图(2026-11-04)
 *
 * 打印层在屏幕上被 `@media screen{left:-10000px;opacity:0}` 藏起来了(见 printChannel.js),
 * 普通截图看不到;这里用 CDP `Emulation.setEmulatedMedia({media:'print'})` 切到**打印媒体**再截 A4 横向,
 * 看到的就是真正会打出去的版式。
 *
 * 用法: node shot-print-preview.mjs [base]
 * 产物: shot-print-2hao-4rows.png(2号车间 勾4行 → 10 列)、shot-print-2hao-1row.png(单行 → 3 列)、
 *       shot-print-1hao-16cols.png(1号机 勾2行 → 16 列,验列挤压版式)
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://localhost:5173'
const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`
const BTN_JS = `(() => [...document.querySelectorAll('button')].find(b => (b.innerText || '').replace(/\\s+/g,'').startsWith('排单计划')))()`

const s = await launch({ port: 9483 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 950, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login', 2000); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(4500)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard', 3000); await sleep(9000)

  /** 选线 + 勾选指定工单号(为空=全勾) + 打桩 print + 点排单计划 + 打印媒体截图 */
  async function shoot(line, wantNos, out) {
    console.log(`\n=== ${line} / ${wantNos?.join(',') || '全部勾选'} ===`)
    await s.evaluate(`(() => {
      const hit = [...document.querySelectorAll('.wb-line')].find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === ${JSON.stringify(line)})
      if (hit) (hit.querySelector('.wb-line-name') || hit).click()
      return 'ok'
    })()`)
    await sleep(6500)
    await s.evaluate(`(() => {
      const rows = [...document.querySelectorAll('.wb-block .el-table__body tbody tr, .wb-block .el-table__body-wrapper tbody tr')]
      const want = ${JSON.stringify(wantNos || [])}
      let n = 0
      for (const tr of rows) {
        const t = tr.innerText || ''
        if (want.length && !want.some((w) => t.includes(w))) continue
        const box = tr.querySelector('td:first-child .el-checkbox')
        if (box) { (box.querySelector('input') || box).click(); n++ }
      }
      window.print = function () { window.__printed = (window.__printed || 0) + 1 }
      return 'ok'
    })()`)
    await sleep(900)
    await s.evaluate(`(() => { const b = ${BTN_JS}; if (b) b.click(); return 'ok' })()`)
    await sleep(3200)
    // 切打印媒体 + A4 横向(297×210mm ≈ 1123×794px @96dpi),2 倍清晰度
    await s.send('Emulation.setEmulatedMedia', { media: 'print' })
    await s.send('Emulation.setDeviceMetricsOverride', { width: 1123, height: 794, deviceScaleFactor: 2, mobile: false })
    await sleep(900)
    const png = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    await fs.writeFile(new URL('./' + out, import.meta.url), Buffer.from(png.result.data, 'base64'))
    console.log('[written]', out)
    const heads = JSON.parse(await s.evaluate(`(() => {
      const host = document.getElementById('yj-print-host')
      return JSON.stringify({ n: host ? host.querySelectorAll('tbody tr').length : 0,
        heads: host ? [...host.querySelectorAll('thead th')].map(t => (t.innerText||'').trim()) : [] })
    })()`))
    console.log('日期列表头 =', JSON.stringify(heads.heads.filter((h) => /\d+[\/月]/.test(h))))
    // 复位屏幕媒体
    await s.send('Emulation.setEmulatedMedia', { media: '' })
    await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 950, deviceScaleFactor: 1, mobile: false })
    await s.navigate(BASE + '/#/prod/plan/workOrderBoard', 2500); await sleep(7000)
  }

  await shoot('2号车间', null, 'shot-print-2hao-4rows.png')
  await shoot('2号车间', ['GD-2026-10-0227'], 'shot-print-2hao-1row.png')
  await shoot('1号机', null, 'shot-print-1hao-16cols.png')

  if (s.logs.length) console.log('页面错误日志:', s.logs.slice(0, 5))
  console.log('DONE')
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
