/**
 * _q-print-tabs2.mjs —— 多页签打印验证(通用版)
 *   不做「先找元素」的前置判断,直接点「打印」并抓拦截结果 + 提示语 + 页签还原。
 * 用法: node _q-print-tabs2.mjs [base] [panelCode]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANEL = process.argv[3] || 'RD_ASM_PROC'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v) : v) }

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const r = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: PANEL, pageNo: 1, pageSize: 1, condition: {} }),
})).json()
const row = (r?.data?.list || [])[0] || {}
const no = String(row['单据编号'] || row['编号'] || '')
log('目标单', PANEL + ' / ' + no)

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

const s = await launch({ port: 9471 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(`${BASE}/#/panelx/list/${PANEL}?docNo=${encodeURIComponent(no)}`)
  // 等「打印」按钮出现(它就是文书路径的标志),不依赖页签 DOM
  let hasBtn = false
  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    hasBtn = await s.evaluate(`[...document.querySelectorAll('.as-side-btn')].some(x => (x.textContent||'').trim() === '打印')`)
    if (hasBtn) break
  }
  log('有打印按钮', hasBtn)
  log('页签', await s.evaluate(`[...document.querySelectorAll('.rsp-page-tab')].map(e=>(e.textContent||'').trim())`))

  await s.evaluate(`(() => {
    window.__printProbe = { opens: [] }
    window.open = function (url) {
      const i = window.__printProbe.opens.push({ url: String(url).slice(0, 40), size: 0, pages: null }) - 1
      fetch(url).then(r => r.blob()).then(async (b) => {
        const buf = new Uint8Array(await b.arrayBuffer())
        let text = ''
        for (let k = 0; k < buf.length; k++) text += String.fromCharCode(buf[k])
        const pages = (text.match(/\\/Type\\s*\\/Page[^s]/g) || []).length
        window.__printProbe.opens[i].size = b.size
        window.__printProbe.opens[i].pages = pages
      }).catch(e => { window.__printProbe.opens[i].err = String(e && e.message || e) })
      return { location: {}, close(){}, focus(){} }
    }
    return 'patched'
  })()`)

  const clicked = await s.evaluate(`(() => {
    const el = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent||'').trim() === '打印')
    if (!el) return 'not-found'
    el.click(); return 'clicked'
  })()`)
  log('点打印', clicked)

  let probe = null
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    probe = await s.evaluate(`JSON.parse(JSON.stringify(window.__printProbe || {}))`)
    if (probe.opens && probe.opens.length && probe.opens[0].pages) break
  }
  log('拦截结果', probe)
  log('提示语', await s.evaluate(`(()=>[...document.querySelectorAll('.el-message__content')].map(e=>(e.textContent||'').trim()).filter(Boolean).slice(-2))()`))
  log('打印后当前页签', await s.evaluate(`(()=>{const e=document.querySelector('.rsp-page-tab.active');return e?(e.textContent||'').trim():null})()`))
} finally {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-print-tabs2.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
