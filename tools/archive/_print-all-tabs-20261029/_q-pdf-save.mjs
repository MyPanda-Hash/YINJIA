/**
 * _q-pdf-save.mjs —— 把多页签打印件存成本地 PDF(供 render 成图肉眼复核)
 * 用法: node _q-pdf-save.mjs [base] [panelCode] [outName]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANEL = process.argv[3] || 'RD_ASM_PROC'
const NAME = process.argv[4] || 'asm-proc'

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
console.log('目标单 =', PANEL, '/', no)

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

const s = await launch({ port: 9474 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(`${BASE}/#/panelx/list/${PANEL}?docNo=${encodeURIComponent(no)}`)
  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    if (await s.evaluate(`[...document.querySelectorAll('.as-side-btn')].some(x => (x.textContent||'').trim() === '打印')`)) break
  }

  // 拦 window.open,把 blob 转 base64 存下来
  await s.evaluate(`(() => {
    window.__pdfData = null
    window.open = function (url) {
      fetch(url).then(r => r.blob()).then(async (b) => {
        const buf = new Uint8Array(await b.arrayBuffer())
        let bin = ''
        for (let k = 0; k < buf.length; k++) bin += String.fromCharCode(buf[k])
        window.__pdfData = btoa(bin)
      }).catch(e => { window.__pdfErr = String(e && e.message || e) })
      return { location: {}, close(){}, focus(){} }
    }
    return 'patched'
  })()`)

  await s.evaluate(`(() => {
    const el = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent||'').trim() === '打印')
    if (el) el.click(); return !!el
  })()`)

  let b64 = null
  for (let i = 0; i < 40; i++) {
    await sleep(2000)
    b64 = await s.evaluate(`window.__pdfData || null`)
    if (b64) break
  }
  if (!b64) { console.log('!! 没拿到 PDF'); process.exit(1) }
  await fs.writeFile(new URL(`./${NAME}.pdf`, import.meta.url), Buffer.from(b64, 'base64'))
  console.log('saved', NAME + '.pdf', 'bytes =', Buffer.from(b64, 'base64').length)
} finally {
  process.exit(0)
}
