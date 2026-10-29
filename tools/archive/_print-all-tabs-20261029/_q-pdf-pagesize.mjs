/**
 * _q-pdf-pagesize.mjs —— 多页签 PDF 里**每页的物理尺寸/方向是否一致**
 * 用法: node _q-pdf-pagesize.mjs [base] [panelCode]
 *
 * 用户口径(2026-10-29):「组装工艺清单的 bom 表打印出来是横向的,和组装工艺清单的竖向不一样」。
 * 怀疑点:buildSheetPdfBlob 的页面尺寸来自**截图的实际像素**——
 *   orientation: first.w0 * MM > first.h0 * MM ? 'l' : 'p'
 *   addPage([pw, ph], pw > ph ? 'l' : 'p')
 * 而 h0 是**内容高度**:BOM 表只有两三行时 h0 很小 ⇒ w0 > h0 ⇒ 该页被判成横向。
 *
 * 本探针把 PDF 字节里的 /MediaBox 抽出来,逐页报宽高(mm),结论无需肉眼。
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

const s = await launch({ port: 9472 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(`${BASE}/#/panelx/list/${PANEL}?docNo=${encodeURIComponent(no)}`)

  // ① 先在页面上逐页量纸张元素的 scrollWidth/scrollHeight —— 这就是 buildSheetPdfBlob 的来源
  let hasBtn = false
  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    hasBtn = await s.evaluate(`[...document.querySelectorAll('.as-side-btn')].some(x => (x.textContent||'').trim() === '打印')`)
    if (hasBtn) break
  }
  log('有打印按钮', hasBtn)

  const dims = await s.evaluate(`(async () => {
    const out = []
    const tabs = [...document.querySelectorAll('.rsp-page-tab')]
    const el = document.querySelector('.approval-layout .record-sheet')
    if (!el) return { err: 'no .record-sheet', tabs: tabs.map(t => (t.textContent||'').trim()) }
    for (let i = 0; i < tabs.length; i++) {
      tabs[i].click()
      await new Promise(r => setTimeout(r, 700))
      const w = Math.max(el.scrollWidth, el.offsetWidth)
      const h = Math.max(el.scrollHeight, el.offsetHeight)
      out.push({ page: i, title: (tabs[i].textContent||'').trim(), w, h,
                 dir: w > h ? 'landscape' : 'portrait' })
    }
    return out
  })()`)
  log('逐页纸张像素', dims)

  // ② 点打印,抓 PDF 的 MediaBox
  await s.evaluate(`(() => {
    window.__pdf = { opens: [] }
    window.open = function (url) {
      const i = window.__pdf.opens.push({ boxes: [], pages: 0 }) - 1
      fetch(url).then(r => r.blob()).then(async (b) => {
        const buf = new Uint8Array(await b.arrayBuffer())
        let text = ''
        for (let k = 0; k < buf.length; k++) text += String.fromCharCode(buf[k])
        window.__pdf.opens[i].pages = (text.match(/\\/Type\\s*\\/Page[^s]/g) || []).length
        // /MediaBox [0 0 W H]  (pt)
        window.__pdf.opens[i].boxes = [...text.matchAll(/\\/MediaBox\\s*\\[\\s*([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s*\\]/g)]
          .map(m => ({ w: Number(m[3]), h: Number(m[4]),
                       mmW: +(Number(m[3]) * 25.4 / 72).toFixed(1),
                       mmH: +(Number(m[4]) * 25.4 / 72).toFixed(1),
                       dir: Number(m[3]) > Number(m[4]) ? 'landscape' : 'portrait' }))
      }).catch(e => { window.__pdf.opens[i].err = String(e && e.message || e) })
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

  let pdf = null
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    pdf = await s.evaluate(`JSON.parse(JSON.stringify(window.__pdf || {}))`)
    if (pdf.opens && pdf.opens.length && pdf.opens[0].boxes && pdf.opens[0].boxes.length) break
  }
  log('PDF 页面', pdf)
} finally {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-pdf-pagesize.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
